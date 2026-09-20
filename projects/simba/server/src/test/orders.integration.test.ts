import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { calcOrderTotals } from '@simba/shared'
import { InsufficientBonusError } from '../services/bonus.service.js'
import { hasTestDb, skipReason, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createUser, createProductWithVariant, createCart, authHeader, seedDeliveryOptions, createPromoCode } from './factories'

describe.skipIf(!hasTestDb)('Оформление заказа (интеграционные)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    const { buildApp } = await import('../index')
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    if (app) await app.close()
    await closeTestPrisma()
  })

  beforeEach(async () => {
    await resetDb()
    await seedDeliveryOptions()
  })

  const pickupOrder = (cartId: string, extra: Record<string, unknown> = {}) => ({
    cartId,
    deliveryMethod: 'pickup',
    hasSpecialPackaging: false,
    deliveryCost: 0,
    ...extra,
  })

  it('последний товар достаётся только одному из двух покупателей, склад не уходит в минус', async () => {
    const prisma = getTestPrisma()
    const { variant } = await createProductWithVariant({ price: 100000, stock: 1 })

    const userA = await createUser()
    const userB = await createUser()
    const cartA = await createCart(userA.id, [{ variantId: variant.id, quantity: 1 }])
    const cartB = await createCart(userB.id, [{ variantId: variant.id, quantity: 1 }])

    const [resA, resB] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeader(app, userA.id),
        payload: pickupOrder(cartA.id),
      }),
      app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeader(app, userB.id),
        payload: pickupOrder(cartB.id),
      }),
    ])

    const codes = [resA.statusCode, resB.statusCode].sort()
    expect(codes).toEqual([201, 400])

    const failed = resA.statusCode === 400 ? resA : resB
    expect(failed.json().error).toMatch(/Недостаточно товара/i)

    const fresh = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })
    expect(fresh.stock).toBe(0)

    expect(await prisma.order.count()).toBe(1)
  })

  it('двойной клик по «Оформить» создаёт ровно один заказ, второй запрос — 409 DUPLICATE_ORDER', async () => {
    const prisma = getTestPrisma()
    const { variant } = await createProductWithVariant({ price: 100000, stock: 10 })
    const user = await createUser({ bonusPoints: 0 })
    const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 2 }])

    const send = () =>
      app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeader(app, user.id),
        payload: pickupOrder(cart.id),
      })

    const [r1, r2] = await Promise.all([send(), send()])

    const created = [r1, r2].filter((r) => r.statusCode === 201)
    const rejected = [r1, r2].filter((r) => r.statusCode !== 201)
    expect(created).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0].statusCode).toBe(409)
    expect(rejected[0].json().code).toBe('DUPLICATE_ORDER')

    expect(await prisma.order.count()).toBe(1)

    const fresh = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })
    expect(fresh.stock).toBe(8)

    // Оформление бонусы не начисляет — только списывает. Списывать было нечего
    // (стартовый баланс 0, bonusUsed не запрашивали), поэтому баланс остаётся 0,
    // а рассчитанный bonusEarned просто лежит в заказе до оплаты.
    const order = await prisma.order.findFirstOrThrow()
    expect(order.bonusEarned).toBeGreaterThan(0)
    expect(order.bonusEarnedCredited).toBe(false)
    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(freshUser.bonusPoints).toBe(0)
  })

  it('чужой заказ не отдаётся: 404 и никаких данных о сумме, составе и адресе', async () => {
    const userA = await createUser()
    const userB = await createUser()
    const { variant } = await createProductWithVariant({ price: 250000, stock: 5 })
    const cartA = await createCart(userA.id, [{ variantId: variant.id, quantity: 1 }])

    const createdRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(app, userA.id),
      payload: pickupOrder(cartA.id, {
        comment: 'секретный комментарий',
      }),
    })
    expect(createdRes.statusCode).toBe(201)
    const orderId = createdRes.json().id

    const foreign = await app.inject({
      method: 'GET',
      url: `/api/orders/${orderId}`,
      headers: authHeader(app, userB.id),
    })

    expect(foreign.statusCode).toBe(404)
    expect(foreign.body).not.toMatch(/250000/)
    expect(foreign.body).not.toMatch(/секретный комментарий/)
    expect(foreign.json()).toEqual({ error: 'Заказ не найден' })

    const listB = await app.inject({
      method: 'GET',
      url: '/api/orders',
      headers: authHeader(app, userB.id),
    })
    expect(listB.statusCode).toBe(200)
    expect(listB.json()).toEqual([])

    const listA = await app.inject({
      method: 'GET',
      url: '/api/orders',
      headers: authHeader(app, userA.id),
    })
    expect(listA.json()).toHaveLength(1)
    expect(listA.json()[0].id).toBe(orderId)
  })

  it('без токена заказ не оформляется', async () => {
    const prisma = getTestPrisma()
    const user = await createUser()
    const { variant } = await createProductWithVariant({ price: 100000, stock: 5 })
    const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 1 }])

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: pickupOrder(cart.id),
    })

    expect(res.statusCode).toBe(401)
    expect(await prisma.order.count()).toBe(0)
  })

  it('промокод, бонусы и самовывоз считаются так же, как calcOrderTotals', async () => {
    const prisma = getTestPrisma()
    const price = 200000
    const quantity = 3
    const { variant } = await createProductWithVariant({ price, stock: 10 })
    const user = await createUser({ bonusPoints: 500 })
    const cart = await createCart(user.id, [{ variantId: variant.id, quantity }])
    const promo = await createPromoCode({ code: 'SIMBA10', type: 'percent', value: 10 })

    const expected = calcOrderTotals({
      items: [{ price, quantity }],
      promo: { type: 'percent', value: 10 },
      bonusRequested: 300,
      availableBonus: 500,
      deliveryCost: 0,
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(app, user.id),
      payload: pickupOrder(cart.id, { promoCode: 'SIMBA10', bonusUsed: 300 }),
    })

    expect(res.statusCode).toBe(201)
    const order = res.json()
    expect(order.subtotal).toBe(expected.subtotal)
    expect(order.total).toBe(expected.total)
    expect(order.bonusUsed).toBe(expected.bonusUsed)
    expect(order.bonusEarned).toBe(expected.bonusEarned)
    expect(order.discount).toBe(expected.promoDiscount)
    expect(order.promoCode).toBe('SIMBA10')

    // Баланс = стартовые 500 минус списанное. Начисление сюда не входит:
    // bonusEarned попадёт на баланс только когда заказ отметят оплаченным.
    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(freshUser.bonusPoints).toBe(500 - expected.bonusUsed)

    // Счётчик использований промокода должен быть инкрементирован
    const freshPromo = await prisma.promoCode.findUniqueOrThrow({ where: { id: promo.id } })
    expect(freshPromo.usedCount).toBe(1)
  })

  it('неизвестный промокод вызывает ошибку 400 и заказ не создаётся', async () => {
    const prisma = getTestPrisma()
    const { variant } = await createProductWithVariant({ price: 100000, stock: 10 })
    const user = await createUser({ bonusPoints: 0 })
    const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 1 }])

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(app, user.id),
      payload: pickupOrder(cart.id, { promoCode: 'NONEXISTENT' }),
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('PROMO_INVALID')
    expect(res.json().error).toMatch(/Промокод не найден/i)
    expect(await prisma.order.count()).toBe(0)
  })

  it('превышение лимита использований промокода вызывает ошибку', async () => {
    const prisma = getTestPrisma()
    const { variant } = await createProductWithVariant({ price: 100000, stock: 100 })
    const user1 = await createUser({ bonusPoints: 0 })
    const user2 = await createUser({ bonusPoints: 0 })
    const promo = await createPromoCode({ code: 'LIMITED', type: 'percent', value: 10, maxUses: 1 })

    const cart1 = await createCart(user1.id, [{ variantId: variant.id, quantity: 1 }])
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(app, user1.id),
      payload: pickupOrder(cart1.id, { promoCode: 'LIMITED' }),
    })
    expect(res1.statusCode).toBe(201)
    expect(await prisma.promoCode.findUniqueOrThrow({ where: { id: promo.id } })).toMatchObject({
      usedCount: 1,
    })

    const cart2 = await createCart(user2.id, [{ variantId: variant.id, quantity: 1 }])
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(app, user2.id),
      payload: pickupOrder(cart2.id, { promoCode: 'LIMITED' }),
    })
    expect(res2.statusCode).toBe(400)
    expect(res2.json().code).toBe('PROMO_INVALID')
    expect(res2.json().error).toMatch(/Лимит использований/i)

    // usedCount должен остаться 1 (вторая попытка не инкрементировала)
    expect(await prisma.promoCode.findUniqueOrThrow({ where: { id: promo.id } })).toMatchObject({
      usedCount: 1,
    })
  })

  it('корзина очищается после успеха и остаётся нетронутой при недостатке товара', async () => {
    const prisma = getTestPrisma()
    const okUser = await createUser()
    const { variant: okVariant } = await createProductWithVariant({ price: 100000, stock: 5 })
    const okCart = await createCart(okUser.id, [{ variantId: okVariant.id, quantity: 2 }])

    const okRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(app, okUser.id),
      payload: pickupOrder(okCart.id),
    })
    expect(okRes.statusCode).toBe(201)
    expect(await prisma.cartItem.count({ where: { cartId: okCart.id } })).toBe(0)

    const failUser = await createUser()
    const { variant: scarce } = await createProductWithVariant({ price: 100000, stock: 5 })
    const failCart = await createCart(failUser.id, [{ variantId: scarce.id, quantity: 2 }])

    // остаток проседает уже после наполнения корзины
    await prisma.productVariant.update({ where: { id: scarce.id }, data: { stock: 1 } })

    const failRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(app, failUser.id),
      payload: pickupOrder(failCart.id),
    })

    expect(failRes.statusCode).toBe(400)
    expect(failRes.json().error).toMatch(/Недостаточно товара/i)

    const items = await prisma.cartItem.findMany({ where: { cartId: failCart.id } })
    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(2)
    expect(await prisma.order.count({ where: { userId: failUser.id } })).toBe(0)
  })

  it('товар с нулевой ценой нельзя добавить в корзину', async () => {
    const prisma = getTestPrisma()
    const user = await createUser()
    const { variant } = await createProductWithVariant({ price: 0, stock: 10 })

    const res = await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers: authHeader(app, user.id),
      payload: { productVariantId: variant.id, quantity: 1 },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/недоступен/i)
    expect(await prisma.cartItem.count()).toBe(0)
  })

  it('баланс бонусов не уходит в минус при двух одновременных списаниях', async () => {
    const prisma = getTestPrisma()
    // Проверка идёт по сервису списания, а не по двум HTTP-заказам. Через роут
    // эта гонка недостижима: у пользователя ОДНА корзина (Cart.userId уникален),
    // а признаком дубля служит её очистка (order.service.ts:395) — второй запрос
    // получил бы DUPLICATE_ORDER, не дойдя до бонусов. Прежняя версия теста
    // заводила две корзины одному пользователю и падала на уникальном индексе,
    // то есть не выполнялась ни разу.
    const user = await createUser({ bonusPoints: 500 })

    const { applyBonusChange } = await import('../services/bonus.service.js')
    const spend = () =>
      prisma.$transaction((tx) =>
        applyBonusChange(tx as never, {
          userId: user.id,
          amount: -500,
          type: 'spent',
          requireSufficient: true,
        })
      )

    // Оба списания законны по отдельности и несовместимы вместе: на балансе
    // ровно 500. С балансом 1000 тест проходил бы и при снятой защите.
    const results = await Promise.allSettled([spend(), spend()])

    const ok = results.filter((r) => r.status === 'fulfilled')
    const failed = results.filter((r) => r.status === 'rejected')
    expect(ok).toHaveLength(1)
    expect(failed).toHaveLength(1)
    expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientBonusError)

    // Списание прошло ровно один раз: 500 − 500 = 0, а не −500.
    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(freshUser.bonusPoints).toBe(0)

    const spent = await prisma.bonusTransaction.findMany({ where: { userId: user.id } })
    expect(spent).toHaveLength(1)
  })

  it('лимит 50% срезает запрос: в заказ и в баланс уходит урезанная сумма', async () => {
    const prisma = getTestPrisma()
    const { variant } = await createProductWithVariant({ price: 100000, stock: 5 })
    const user = await createUser({ bonusPoints: 900 })
    const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 1 }])

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(app, user.id),
      payload: pickupOrder(cart.id, { bonusUsed: 900 }),
    })

    // Чек 1000 ₽ → списать можно 500, хотя запрошено 900.
    expect(res.statusCode).toBe(201)
    const order = res.json()
    expect(order.bonusUsed).toBe(500)
    expect(order.total).toBe(50000)
    expect(order.bonusEarned).toBe(25)

    // Списали урезанные лимитом 500 из 900. Начисленные 25 на баланс пока не
    // попадают — заказ не оплачен, они ждут отметки «оплачен».
    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(freshUser.bonusPoints).toBe(900 - 500)
  })

  describe('Жизненный цикл бонусов', () => {
    // Базовый сценарий: баланс 1000, товар 1000 ₽, списываем 300 Scoins.
    // Чек 100000 коп → лимит 50% = 500, запрос 300 проходит целиком.
    // Оплачено деньгами за товар: 100000 − 30000 = 70000 коп → начисление 35.
    const PRICE = 100000
    const USED = 300
    const EARNED = 35
    const START = 1000
    const AFTER_CHECKOUT = START - USED

    async function adminHeaders() {
      const admin = await createUser({ name: 'Менеджер заказов' })
      return authHeader(app, admin.id, 'orders_manager')
    }

    async function placeOrder(
      opts: { balance?: number; bonusUsed?: number; price?: number } = {}
    ) {
      const { variant } = await createProductWithVariant({
        price: opts.price ?? PRICE,
        stock: 5,
      })
      const user = await createUser({ bonusPoints: opts.balance ?? START })
      const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 1 }])

      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeader(app, user.id),
        payload: pickupOrder(cart.id, { bonusUsed: opts.bonusUsed ?? 0 }),
      })

      expect(res.statusCode).toBe(201)
      return { user, order: res.json() as { id: string; bonusUsed: number; bonusEarned: number } }
    }

    const setPayment = (
      orderId: string,
      paymentStatus: 'paid' | 'failed' | 'refunded',
      headers: Record<string, string>
    ) =>
      app.inject({
        method: 'PUT',
        url: `/api/admin/orders/${orderId}/payment`,
        headers,
        payload: { paymentStatus },
      })

    const setStatus = (
      orderId: string,
      status: 'confirmed' | 'in_transit' | 'delivered' | 'cancelled',
      headers: Record<string, string>
    ) =>
      app.inject({
        method: 'PUT',
        url: `/api/admin/orders/${orderId}/status`,
        headers,
        payload: { status },
      })

    const balanceOf = async (userId: string) =>
      (await getTestPrisma().user.findUniqueOrThrow({ where: { id: userId } })).bonusPoints

    const orderRow = async (orderId: string) =>
      getTestPrisma().order.findUniqueOrThrow({ where: { id: orderId } })

    it('11: оформление списывает бонусы, но не начисляет — начисление ждёт оплаты', async () => {
      const { user, order } = await placeOrder({ bonusUsed: USED })

      expect(order.bonusUsed).toBe(USED)
      expect(order.bonusEarned).toBe(EARNED)
      expect(await balanceOf(user.id)).toBe(AFTER_CHECKOUT)

      const row = await orderRow(order.id)
      expect(row.paymentStatus).toBe('pending')
      expect(row.bonusEarnedCredited).toBe(false)
      expect(row.bonusUsedRefunded).toBe(false)
    })

    it('12: отметка «оплачен» начисляет ровно bonusEarned и взводит защёлку', async () => {
      const { user, order } = await placeOrder({ bonusUsed: USED })
      const headers = await adminHeaders()

      const res = await setPayment(order.id, 'paid', headers)

      expect(res.statusCode).toBe(200)
      expect(await balanceOf(user.id)).toBe(AFTER_CHECKOUT + EARNED)

      const row = await orderRow(order.id)
      expect(row.paymentStatus).toBe('paid')
      expect(row.bonusEarnedCredited).toBe(true)
    })

    it('13: повторная отметка «оплачен» не начисляет второй раз', async () => {
      const { user, order } = await placeOrder({ bonusUsed: USED })
      const headers = await adminHeaders()

      await setPayment(order.id, 'paid', headers)
      const second = await setPayment(order.id, 'paid', headers)

      expect(second.statusCode).toBe(200)
      expect(await balanceOf(user.id)).toBe(AFTER_CHECKOUT + EARNED)
    })

    it('14: возврат платежа снимает начисленное и возвращает списанное', async () => {
      const { user, order } = await placeOrder({ bonusUsed: USED })
      const headers = await adminHeaders()

      await setPayment(order.id, 'paid', headers)
      const res = await setPayment(order.id, 'refunded', headers)

      expect(res.statusCode).toBe(200)
      // 700 + 35 (оплата) + 300 (возврат списанного) − 35 (снятие начисленного) = 1000
      expect(await balanceOf(user.id)).toBe(START)

      const row = await orderRow(order.id)
      expect(row.paymentStatus).toBe('refunded')
      expect(row.bonusEarnedCredited).toBe(false)
      expect(row.bonusUsedRefunded).toBe(true)
    })

    it('15: отмена неоплаченного заказа возвращает списанное и не снимает неначисленное', async () => {
      const { user, order } = await placeOrder({ bonusUsed: USED })
      const headers = await adminHeaders()

      const res = await setStatus(order.id, 'cancelled', headers)

      expect(res.statusCode).toBe(200)
      expect(await balanceOf(user.id)).toBe(START)

      const row = await orderRow(order.id)
      expect(row.status).toBe('cancelled')
      expect(row.bonusUsedRefunded).toBe(true)
      expect(row.bonusEarnedCredited).toBe(false)
    })

    it('16: отмена оплаченного заказа возвращает списанное и снимает начисленное', async () => {
      const { user, order } = await placeOrder({ bonusUsed: USED })
      const headers = await adminHeaders()

      await setPayment(order.id, 'paid', headers)
      expect(await balanceOf(user.id)).toBe(AFTER_CHECKOUT + EARNED)

      await setStatus(order.id, 'cancelled', headers)

      expect(await balanceOf(user.id)).toBe(START)
    })

    it('17: повторная отмена не возвращает списанное дважды', async () => {
      const { user, order } = await placeOrder({ bonusUsed: USED })
      const headers = await adminHeaders()

      await setStatus(order.id, 'cancelled', headers)
      await setStatus(order.id, 'cancelled', headers)

      expect(await balanceOf(user.id)).toBe(START)
    })

    it('18: двойной клик «оплачен» начисляет бонусы ровно один раз', async () => {
      const { user, order } = await placeOrder({ bonusUsed: USED })
      const headers = await adminHeaders()

      // Тест обязан быть переподписан: начисление ненулевое, поэтому проверка
      // «баланс вырос ровно на EARNED» упадёт, если убрать условный захват
      // перехода (paymentStatus: { not: 'paid' }) — тогда начислят оба запроса.
      expect(order.bonusEarned).toBeGreaterThan(0)

      const [r1, r2] = await Promise.all([
        setPayment(order.id, 'paid', headers),
        setPayment(order.id, 'paid', headers),
      ])

      expect([r1.statusCode, r2.statusCode]).toEqual([200, 200])
      expect(await balanceOf(user.id)).toBe(AFTER_CHECKOUT + EARNED)
      expect((await orderRow(order.id)).bonusEarnedCredited).toBe(true)
    })

    it('19: двойная отмена возвращает списанное ровно один раз', async () => {
      const { user, order } = await placeOrder({ bonusUsed: USED })
      const headers = await adminHeaders()

      // Тоже переподписан: списание ненулевое, и при снятом условном захвате
      // (status: { not: 'cancelled' }) баланс стал бы 1300 вместо 1000.
      expect(order.bonusUsed).toBeGreaterThan(0)

      const [r1, r2] = await Promise.all([
        setStatus(order.id, 'cancelled', headers),
        setStatus(order.id, 'cancelled', headers),
      ])

      expect([r1.statusCode, r2.statusCode]).toEqual([200, 200])
      expect(await balanceOf(user.id)).toBe(START)
      expect((await orderRow(order.id)).bonusUsedRefunded).toBe(true)
    })

    it('20: уровень пересчитывается при начислении и при возврате', async () => {
      const prisma = getTestPrisma()
      // Товар 20 000 ₽ → начисление 1000 Scoins. Баланс 500 + 1000 = 1500 → «Активный».
      const { user, order } = await placeOrder({ balance: 500, price: 2_000_000 })
      const headers = await adminHeaders()

      expect(order.bonusEarned).toBe(1000)
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).bonusLevel).toBe(
        'newcomer'
      )

      await setPayment(order.id, 'paid', headers)

      const afterPaid = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
      expect(afterPaid.bonusPoints).toBe(1500)
      expect(afterPaid.bonusLevel).toBe('active')

      await setPayment(order.id, 'refunded', headers)

      const afterRefund = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
      expect(afterRefund.bonusPoints).toBe(500)
      expect(afterRefund.bonusLevel).toBe('newcomer')
    })

    it('21: покупатель не может сам отметить свой заказ оплаченным', async () => {
      const { user, order } = await placeOrder({ bonusUsed: USED })

      const asCustomer = await setPayment(order.id, 'paid', authHeader(app, user.id))
      expect(asCustomer.statusCode).toBe(403)

      const noToken = await app.inject({
        method: 'PUT',
        url: `/api/admin/orders/${order.id}/payment`,
        payload: { paymentStatus: 'paid' },
      })
      expect(noToken.statusCode).toBe(401)

      const asCustomerStatus = await setStatus(order.id, 'cancelled', authHeader(app, user.id))
      expect(asCustomerStatus.statusCode).toBe(403)

      // Ни бонусы, ни статусы заказа не сдвинулись.
      expect(await balanceOf(user.id)).toBe(AFTER_CHECKOUT)
      const row = await orderRow(order.id)
      expect(row.paymentStatus).toBe('pending')
      expect(row.status).toBe('new')
      expect(row.bonusEarnedCredited).toBe(false)
      expect(row.bonusUsedRefunded).toBe(false)
    })

    it('22: отмена → оплата → возврат платежа не возвращает списанное дважды', async () => {
      const { user, order } = await placeOrder({ bonusUsed: USED })
      const headers = await adminHeaders()

      await setStatus(order.id, 'cancelled', headers)
      expect(await balanceOf(user.id)).toBe(START)

      // Отменённый заказ вообще не переходит в «оплачен»: условный захват
      // в markOrderPaid отсекает status = cancelled. Баланс не двигается.
      await setPayment(order.id, 'paid', headers)
      expect(await balanceOf(user.id)).toBe(START)
      expect((await orderRow(order.id)).paymentStatus).not.toBe('paid')
      expect((await orderRow(order.id)).bonusUsedRefunded).toBe(true)

      // Возврат платежа по уже отменённому заказу тоже ничего не возвращает
      // повторно: защёлка bonusUsedRefunded закрыта.
      await setPayment(order.id, 'refunded', headers)
      expect(await balanceOf(user.id)).toBe(START)
    })
  })

  describe('Пункты выдачи (PickupPoint)', () => {
    it('заказ с deliveryPoint (pickup) → 201, deliveryPoint null (игнорируется)', async () => {
      const prisma = getTestPrisma()
      const { variant } = await createProductWithVariant({ price: 100000, stock: 10 })
      const user = await createUser()
      const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 1 }])

      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeader(app, user.id),
        payload: {
          cartId: cart.id,
          deliveryMethod: 'pickup',
          deliveryPoint: {
            provider: 'cdek',
            code: 'MSK123',
            name: 'Пункт СДЭК',
            address: 'Москва',
            lat: 55.7558,
            lon: 37.6173,
          },
          hasSpecialPackaging: false,
          deliveryCost: 0,
        },
      })

      expect(res.statusCode).toBe(201)
      const order = res.json()
      expect(order.deliveryPoint).toBeNull()
    })

    it('simba_courier без улицы и дома → 400', async () => {
      const { variant } = await createProductWithVariant({ price: 100000, stock: 10 })
      const user = await createUser()
      const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 1 }])

      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeader(app, user.id),
        payload: {
          cartId: cart.id,
          deliveryMethod: 'simba_courier',
          deliveryAddress: { city: 'Москва' },
          hasSpecialPackaging: false,
          deliveryCost: 70000,
        },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/улиц.*дом|дом.*улиц/i)
    })

    it('deliveryPoint.provider не совпадает с deliveryMethod → 400', async () => {
      const { variant } = await createProductWithVariant({ price: 100000, stock: 10 })
      const user = await createUser()
      const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 1 }])

      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeader(app, user.id),
        payload: {
          cartId: cart.id,
          deliveryMethod: 'cdek',
          deliveryAddress: { city: 'Москва' },
          deliveryPoint: {
            provider: 'yandex',
            code: 'abc123',
            name: 'Пункт Яндекса',
            address: 'Москва',
            lat: 55.7558,
            lon: 37.6173,
          },
          hasSpecialPackaging: false,
          deliveryCost: 9900,
        },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/службе/i)
    })

    it('cash_on_delivery + deliveryPoint → 400', async () => {
      const { variant } = await createProductWithVariant({ price: 100000, stock: 10 })
      const user = await createUser()
      const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 1 }])

      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeader(app, user.id),
        payload: {
          cartId: cart.id,
          deliveryMethod: 'yandex',
          deliveryAddress: { city: 'Москва', street: 'ул. Тверская', house: '1' },
          deliveryPoint: {
            provider: 'yandex',
            code: 'abc123',
            name: 'Пункт Яндекса',
            address: 'Москва',
            lat: 55.7558,
            lon: 37.6173,
          },
          hasSpecialPackaging: false,
          deliveryCost: 0,
          paymentMethod: 'cash_on_delivery',
        },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/курьеру|наличными/i)
    })

    it('доставка без city → 400', async () => {
      const { variant } = await createProductWithVariant({ price: 100000, stock: 10 })
      const user = await createUser()
      const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 1 }])

      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeader(app, user.id),
        payload: {
          cartId: cart.id,
          deliveryMethod: 'yandex',
          deliveryAddress: { street: 'ул. Тверская', house: '1' },
          hasSpecialPackaging: false,
          deliveryCost: 0,
        },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/город|city/i)
    })
  })
})
