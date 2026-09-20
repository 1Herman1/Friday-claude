import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { CONSENT_VERSION } from '@simba/shared'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createUser, createProductWithVariant, createGuestSession, seedDeliveryOptions } from './factories'
import { otpService } from '../services/otp.service'

describe.skipIf(!hasTestDb)('Гостевой чекаут и email-вход (интеграционные)', () => {
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

  // Rate-limit гостевых сессий и заказов хранится в памяти процесса и ключуется
  // по IP. resetDb его не чистит, поэтому каждому тесту — свой адрес, иначе
  // результат зависел бы от порядка запуска.
  let ipCounter = 0
  const nextIp = () => {
    ipCounter += 1
    return `10.10.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`
  }

  const pickupOrder = (cartId: string, extra: Record<string, unknown> = {}) => ({
    cartId,
    deliveryMethod: 'pickup',
    hasSpecialPackaging: false,
    deliveryCost: 0,
    consentVersion: CONSENT_VERSION,
    ...extra,
  })

  /** Гостевая сессия + товар в её корзине. Возвращает всё, что нужно для заказа. */
  async function guestWithItem(
    ip: string,
    opts: { price?: number; stock?: number; quantity?: number } = {}
  ) {
    const { variant } = await createProductWithVariant({
      price: opts.price ?? 100000,
      stock: opts.stock ?? 10,
    })
    const guest = await createGuestSession(app, ip)

    const res = await app.inject({
      method: 'POST',
      url: '/api/cart/items',
      headers: guest.headers,
      remoteAddress: ip,
      payload: { productVariantId: variant.id, quantity: opts.quantity ?? 1 },
    })
    expect(res.statusCode).toBe(201)

    return { ...guest, variant, cartId: res.json().id as string }
  }

  const sendOrder = (
    guest: { headers: Record<string, string> },
    ip: string,
    payload: Record<string, unknown>
  ) =>
    app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: guest.headers,
      remoteAddress: ip,
      payload,
    })

  it('гость оформляет заказ: заказ привязан к реальному пользователю по email, а не к гостевому', async () => {
    const prisma = getTestPrisma()
    const ip = nextIp()
    const guest = await guestWithItem(ip)

    const res = await sendOrder(guest, ip, {
      ...pickupOrder(guest.cartId),
      contact: { name: 'Иван Гостев', email: 'Ivan.Guest@Example.Test', phone: '+79990000001' },
    })

    expect(res.statusCode).toBe(201)
    const order = res.json()
    expect(order.contactEmail).toBe('Ivan.Guest@Example.Test')

    // Владелец заказа — не гость, а найденный/созданный по email покупатель.
    expect(order.userId).not.toBe(guest.userId)

    const owner = await prisma.user.findUniqueOrThrow({ where: { id: order.userId } })
    expect(owner.email).toBe('ivan.guest@example.test')
    expect(owner.name).toBe('Иван Гостев')
    // Приветственный бонус гостевому заказу не выдаётся — он ждёт входа по OTP.
    expect(owner.welcomeBonusGranted).toBe(false)
    expect(owner.bonusPoints).toBe(0)

    // Корзина гостя очищена, склад списан.
    expect(await prisma.cartItem.count({ where: { cartId: guest.cartId } })).toBe(0)
    const fresh = await prisma.productVariant.findUniqueOrThrow({ where: { id: guest.variant.id } })
    expect(fresh.stock).toBe(9)

    // Заказ помечен как гостевой
    expect(order.guestCheckout).toBe(true)
  })

  it('гость не может списать бонусы по чужому email: 400 и заказа нет', async () => {
    const prisma = getTestPrisma()
    const ip = nextIp()

    // На аккаунте жертвы лежат бонусы — гость подставляет её email и просит списание.
    const victim = await prisma.user.create({
      data: { name: 'Владелец бонусов', email: 'victim@example.test', bonusPoints: 5000 },
    })

    const guest = await guestWithItem(ip)

    const res = await sendOrder(guest, ip, {
      ...pickupOrder(guest.cartId, { bonusUsed: 500 }),
      contact: { name: 'Гость', email: 'victim@example.test', phone: '+79990000002' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/после входа/i)

    expect(await prisma.order.count()).toBe(0)
    const freshVictim = await prisma.user.findUniqueOrThrow({ where: { id: victim.id } })
    expect(freshVictim.bonusPoints).toBe(5000)
  })

  it('гость без контактов не оформляет заказ: 400', async () => {
    const prisma = getTestPrisma()
    const ip = nextIp()
    const guest = await guestWithItem(ip)

    const res = await sendOrder(guest, ip, pickupOrder(guest.cartId))

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/email/i)
    expect(await prisma.order.count()).toBe(0)
  })

  it('гость с доставкой, но без телефона не оформляет заказ: 400', async () => {
    const prisma = getTestPrisma()
    const ip = nextIp()
    const guest = await guestWithItem(ip)

    const res = await sendOrder(guest, ip, {
      cartId: guest.cartId,
      deliveryMethod: 'simba_courier',
      hasSpecialPackaging: false,
      deliveryCost: 70000,
      deliveryAddress: {
        city: 'Москва',
        street: 'Ленина',
        house: '1',
        postalCode: '101000',
      },
      contact: { name: 'Без телефона', email: 'nophone@example.test' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/телефон/i)
    expect(await prisma.order.count()).toBe(0)
  })

  it('два гостевых заказа на один email привязываются к одному пользователю', async () => {
    const prisma = getTestPrisma()
    const ip = nextIp()
    const email = 'repeat@example.test'

    const first = await guestWithItem(ip)
    const res1 = await sendOrder(first, ip, {
      ...pickupOrder(first.cartId),
      contact: { name: 'Повторный покупатель', email, phone: '+79990000003' },
    })
    expect(res1.statusCode).toBe(201)

    // Второй заказ — другая гостевая сессия (гость закрыл вкладку), тот же email.
    const second = await guestWithItem(ip)
    const res2 = await sendOrder(second, ip, {
      ...pickupOrder(second.cartId),
      // другой регистр не должен плодить второго пользователя
      contact: { name: 'Повторный покупатель', email: 'Repeat@Example.Test', phone: '+79990000003' },
    })
    expect(res2.statusCode).toBe(201)

    expect(res2.json().userId).toBe(res1.json().userId)
    expect(await prisma.user.count({ where: { email } })).toBe(1)
    expect(await prisma.order.count({ where: { userId: res1.json().userId } })).toBe(2)
  })

  it('после гостевого заказа вход по OTP выдаёт 300 Scoins ровно один раз', async () => {
    const prisma = getTestPrisma()
    const ip = nextIp()
    const email = 'welcome@example.test'

    const guest = await guestWithItem(ip)
    const orderRes = await sendOrder(guest, ip, {
      ...pickupOrder(guest.cartId),
      contact: { name: 'Новичок', email, phone: '+79990000004' },
    })
    expect(orderRes.statusCode).toBe(201)

    const user = await prisma.user.findFirstOrThrow({ where: { email } })
    expect(user.welcomeBonusGranted).toBe(false)

    const code = await otpService.createOtp(prisma, user.id, 'email', 'login', email)
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { email, code, consentVersion: CONSENT_VERSION },
    })

    expect(login.statusCode).toBe(200)
    expect(login.json().bonusGranted).toBe(300)
    expect(login.json().user.bonusPoints).toBe(300)

    // Второй вход тем же покупателем — защёлка welcomeBonusGranted закрыта.
    const code2 = await otpService.createOtp(prisma, user.id, 'email', 'login', email)
    const login2 = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { email, code: code2, consentVersion: CONSENT_VERSION },
    })
    expect(login2.statusCode).toBe(200)
    expect(login2.json().bonusGranted).toBe(0)
    expect(login2.json().user.bonusPoints).toBe(300)

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(fresh.bonusPoints).toBe(300)
    expect(
      await prisma.bonusTransaction.count({ where: { userId: user.id, type: 'welcome' } })
    ).toBe(1)
  })

  it('вход с гостевым токеном сливает корзины: количества суммируются, ничего не теряется', async () => {
    const prisma = getTestPrisma()
    const ip = nextIp()

    const { variant: shared } = await createProductWithVariant({ price: 100000, stock: 50 })
    const { variant: onlyUser } = await createProductWithVariant({ price: 50000, stock: 50 })
    const { variant: onlyGuest } = await createProductWithVariant({ price: 70000, stock: 50 })

    // Обычный покупатель: в корзине общий вариант (1 шт) и свой (2 шт).
    const user = await createUser()
    const userHeaders = { authorization: `Bearer ${app.jwt.sign({ userId: user.id, role: 'customer' })}` }
    for (const [variantId, quantity] of [
      [shared.id, 1],
      [onlyUser.id, 2],
    ] as const) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: userHeaders,
        payload: { productVariantId: variantId, quantity },
      })
      expect(res.statusCode).toBe(201)
    }

    // Гость: тот же общий вариант (3 шт) и свой (1 шт).
    const guest = await createGuestSession(app, ip)
    for (const [variantId, quantity] of [
      [shared.id, 3],
      [onlyGuest.id, 1],
    ] as const) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: guest.headers,
        remoteAddress: ip,
        payload: { productVariantId: variantId, quantity },
      })
      expect(res.statusCode).toBe(201)
    }

    const code = await otpService.createOtp(prisma, user.id, 'email', 'login', user.email)
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { email: user.email, code, consentVersion: CONSENT_VERSION, guestToken: guest.token },
    })
    expect(login.statusCode).toBe(200)

    const cart = await app.inject({ method: 'GET', url: '/api/cart', headers: userHeaders })
    expect(cart.statusCode).toBe(200)

    const byVariant = new Map<string, number>(
      (cart.json().items as { productVariantId: string; quantity: number }[]).map((i) => [
        i.productVariantId,
        i.quantity,
      ])
    )

    expect(byVariant.get(shared.id)).toBe(4)
    expect(byVariant.get(onlyUser.id)).toBe(2)
    expect(byVariant.get(onlyGuest.id)).toBe(1)
    expect(byVariant.size).toBe(3)

    // Гостевая корзина опустошена — товар не задваивается между аккаунтами.
    const guestCart = await prisma.cart.findUniqueOrThrow({
      where: { userId: guest.userId },
      include: { items: true },
    })
    expect(guestCart.items).toHaveLength(0)
  })

  it('заказ, оформленный гостем, виден после входа по тому же email', async () => {
    const prisma = getTestPrisma()
    const ip = nextIp()
    const email = 'test-visibility@example.com'

    const guest = await guestWithItem(ip)
    const orderRes = await sendOrder(guest, ip, {
      ...pickupOrder(guest.cartId),
      contact: { name: 'Гость Видимый', email, phone: '+79990000007' },
    })
    expect(orderRes.statusCode).toBe(201)
    const orderId = orderRes.json().id as string

    // Отдельный вход, не связанный с той же гостевой сессией: guestToken не передаём.
    // Код берём через otpService — в send-otp он хранится хешем и из БД не восстановим.
    const user = await prisma.user.findFirstOrThrow({ where: { email } })
    const code = await otpService.createOtp(prisma, user.id, 'email', 'login', email)
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { email, code, consentVersion: CONSENT_VERSION },
    })
    expect(login.statusCode).toBe(200)

    const headers = { authorization: `Bearer ${login.json().token}` }

    const list = await app.inject({ method: 'GET', url: '/api/orders', headers })
    expect(list.statusCode).toBe(200)
    expect((list.json() as { id: string }[]).map((o) => o.id)).toContain(orderId)

    const one = await app.inject({ method: 'GET', url: `/api/orders/${orderId}`, headers })
    expect(one.statusCode).toBe(200)
    expect(one.json().id).toBe(orderId)
  })

  it('гостевые сессии с одного IP ограничены: 11-я попытка — 429', async () => {
    const ip = nextIp()

    for (let i = 0; i < 10; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/guest-session',
        remoteAddress: ip,
      })
      expect(res.statusCode).toBe(200)
    }

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/auth/guest-session',
      remoteAddress: ip,
    })
    expect(blocked.statusCode).toBe(429)

    // Соседний IP лимитом не задет.
    const other = await app.inject({
      method: 'POST',
      url: '/api/auth/guest-session',
      remoteAddress: nextIp(),
    })
    expect(other.statusCode).toBe(200)
  })

  it('гостевые заказы с одного IP ограничены: 6-й заказ — 429 и в базу не попадает', async () => {
    const prisma = getTestPrisma()
    const ip = nextIp()

    for (let i = 0; i < 5; i += 1) {
      const guest = await guestWithItem(ip)
      const res = await sendOrder(guest, ip, {
        ...pickupOrder(guest.cartId),
        contact: { name: 'Гость', email: `flood${i}@example.test`, phone: '+79990000005' },
      })
      expect(res.statusCode).toBe(201)
    }

    const extra = await guestWithItem(ip)
    const blocked = await sendOrder(extra, ip, {
      ...pickupOrder(extra.cartId),
      contact: { name: 'Гость', email: 'flood5@example.test', phone: '+79990000005' },
    })

    expect(blocked.statusCode).toBe(429)
    expect(await prisma.order.count()).toBe(5)

    // Лимит по IP, а не глобальный: с другого адреса заказ проходит.
    const otherIp = nextIp()
    const fromOther = await guestWithItem(otherIp)
    const ok = await sendOrder(fromOther, otherIp, {
      ...pickupOrder(fromOther.cartId),
      contact: { name: 'Гость', email: 'other-ip@example.test', phone: '+79990000006' },
    })
    expect(ok.statusCode).toBe(201)
  })
})
