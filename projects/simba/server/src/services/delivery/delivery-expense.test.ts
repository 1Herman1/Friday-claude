import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { computeDeliveryExpense } from './delivery-expense.js'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from '../../test/setup.js'
import { createUser, createProductWithVariant, createCart, authHeader, seedDeliveryOptions } from '../../test/factories.js'
import * as cdek from './providers/cdek.js'
import * as yandexPvz from './providers/yandex-pvz.js'

describe.skipIf(!hasTestDb)('computeDeliveryExpense', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    const { buildApp } = await import('../../index.js')
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

  it('pickup возвращает 0 расходов', async () => {
    const prisma = getTestPrisma()
    const { variant } = await createProductWithVariant()
    const user = await createUser()
    const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 1 }])

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(app, user.id),
      payload: {
        cartId: cart.id,
        deliveryMethod: 'pickup',
        hasSpecialPackaging: false,
        deliveryCost: 0,
      },
    })

    expect(res.statusCode).toBe(201)
    const { id } = res.json()

    // Сбойно: дожидаемся расчёта
    await new Promise((r) => setTimeout(r, 100))

    const order = await prisma.order.findUnique({
      where: { id },
      select: { deliveryExpense: true, deliveryExpenseNote: true },
    })

    expect(order?.deliveryExpense).toBe(0)
    expect(order?.deliveryExpenseNote).toBeNull()
  })

  it('simba_courier берёт expense из справочника', async () => {
    const prisma = getTestPrisma()
    const { variant } = await createProductWithVariant()
    const user = await createUser()
    const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 1 }])

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(app, user.id),
      payload: {
        cartId: cart.id,
        deliveryMethod: 'simba_courier',
        deliveryAddress: { city: 'Москва', street: 'ул. Ленина', house: '12' },
        hasSpecialPackaging: false,
        deliveryCost: 70000,
      },
    })

    expect(res.statusCode).toBe(201)
    const { id } = res.json()

    await new Promise((r) => setTimeout(r, 100))

    const order = await prisma.order.findUnique({
      where: { id },
      select: { deliveryExpense: true, deliveryExpenseNote: true },
    })

    // 25000 копеек из seedDeliveryOptions
    expect(order?.deliveryExpense).toBe(25000)
    expect(order?.deliveryExpenseNote).toBeNull()
  })

  it('cdek с доступным пунктом возвращает цену', async () => {
    const prisma = getTestPrisma()
    const { variant } = await createProductWithVariant()
    const user = await createUser()
    const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 1 }])

    // Мокируем getPickupPointQuote
    const mockQuote = {
      provider: 'cdek',
      key: 'cdek_pvz',
      kind: 'pickup_point' as const,
      title: 'СДЭК',
      description: 'В пункт выдачи',
      price: 34950,
      daysMin: 2,
      daysMax: 5,
      available: true,
    }

    vi.spyOn(cdek, 'getPickupPointQuote').mockResolvedValue(mockQuote)

    const deliveryPoint = {
      provider: 'cdek' as const,
      code: 'PVZ123',
      name: 'Пункт СДЭК',
      address: 'Москва, ул. Пушкина, 1',
      lat: 55.75,
      lon: 37.62,
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(app, user.id),
      payload: {
        cartId: cart.id,
        deliveryMethod: 'cdek',
        deliveryAddress: { city: 'Москва' },
        deliveryPoint,
        hasSpecialPackaging: false,
        deliveryCost: 9900,
      },
    })

    expect(res.statusCode).toBe(201)
    const { id } = res.json()

    // Ждём асинхронного расчёта
    await new Promise((r) => setTimeout(r, 500))

    const order = await prisma.order.findUnique({
      where: { id },
      select: { deliveryExpense: true, deliveryExpenseNote: true },
    })

    expect(order?.deliveryExpense).toBe(34950)
    expect(order?.deliveryExpenseNote).toBeNull()

    vi.restoreAllMocks()
  })

  it('cdek с недоступной службой сохраняет ошибку в note', async () => {
    const prisma = getTestPrisma()
    const { variant } = await createProductWithVariant()
    const user = await createUser()
    const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 1 }])

    const mockQuote = {
      provider: 'cdek',
      key: 'cdek_pvz',
      kind: 'pickup_point' as const,
      title: 'СДЭК',
      description: 'В пункт выдачи',
      price: 0,
      daysMin: 0,
      daysMax: 0,
      available: false,
      error: 'Служба не ответила',
    }

    vi.spyOn(cdek, 'getPickupPointQuote').mockResolvedValue(mockQuote)

    const deliveryPoint = {
      provider: 'cdek' as const,
      code: 'PVZ123',
      name: 'Пункт СДЭК',
      address: 'Москва, ул. Пушкина, 1',
      lat: 55.75,
      lon: 37.62,
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(app, user.id),
      payload: {
        cartId: cart.id,
        deliveryMethod: 'cdek',
        deliveryAddress: { city: 'Москва' },
        deliveryPoint,
        hasSpecialPackaging: false,
        deliveryCost: 9900,
      },
    })

    expect(res.statusCode).toBe(201)
    const { id } = res.json()

    await new Promise((r) => setTimeout(r, 500))

    const order = await prisma.order.findUnique({
      where: { id },
      select: { deliveryExpense: true, deliveryExpenseNote: true },
    })

    expect(order?.deliveryExpense).toBeNull()
    expect(order?.deliveryExpenseNote).toBe('Служба не ответила')

    vi.restoreAllMocks()
  })

  it('cdek с выбросом исключения сохраняет ошибку и не ломает заказ', async () => {
    const prisma = getTestPrisma()
    const { variant } = await createProductWithVariant()
    const user = await createUser()
    const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 1 }])

    vi.spyOn(cdek, 'getPickupPointQuote').mockRejectedValue(new Error('Сетевая ошибка'))

    const deliveryPoint = {
      provider: 'cdek' as const,
      code: 'PVZ123',
      name: 'Пункт СДЭК',
      address: 'Москва, ул. Пушкина, 1',
      lat: 55.75,
      lon: 37.62,
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(app, user.id),
      payload: {
        cartId: cart.id,
        deliveryMethod: 'cdek',
        deliveryAddress: { city: 'Москва' },
        deliveryPoint,
        hasSpecialPackaging: false,
        deliveryCost: 9900,
      },
    })

    // Заказ создаётся успешно, даже если расчёт упал
    expect(res.statusCode).toBe(201)
    const { id } = res.json()

    await new Promise((r) => setTimeout(r, 500))

    const order = await prisma.order.findUnique({
      where: { id },
      select: { deliveryExpense: true, deliveryExpenseNote: true },
    })

    expect(order?.deliveryExpense).toBeNull()
    expect(order?.deliveryExpenseNote).toContain('Ошибка при расчёте расходов')

    vi.restoreAllMocks()
  })

  it('прямо создаём заказ с ozon и проверяем что computeDeliveryExpense его обрабатывает', async () => {
    const prisma = getTestPrisma()
    const { variant } = await createProductWithVariant()
    const user = await createUser()

    // Создаём заказ напрямую в БД с методом ozon (не через API, т.к. он не поддерживает ozon)
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        deliveryMethod: 'ozon',
        subtotal: variant.price,
        total: variant.price,
        deliveryCost: 0,
        items: {
          create: {
            productVariantId: variant.id,
            productId: variant.productId,
            productName: 'Test',
            variantWeight: variant.weight,
            price: variant.price,
            quantity: 1,
          },
        },
      },
    })

    // Вычисляем расходы вручную
    await computeDeliveryExpense(prisma, order.id)

    const updated = await prisma.order.findUnique({
      where: { id: order.id },
      select: { deliveryExpense: true, deliveryExpenseNote: true },
    })

    expect(updated?.deliveryExpense).toBeNull()
    expect(updated?.deliveryExpenseNote).toBe('Расчёт Ozon не подключён')
  })

  it('пересчёт расходов через роут пересчитывает значение', async () => {
    const prisma = getTestPrisma()
    const { variant } = await createProductWithVariant()
    const user = await createUser()
    const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 1 }])

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(app, user.id),
      payload: {
        cartId: cart.id,
        deliveryMethod: 'pickup',
        hasSpecialPackaging: false,
        deliveryCost: 0,
      },
    })

    const { id } = res.json()

    // Обновляем заказ вручную в null
    await prisma.order.update({
      where: { id },
      data: { deliveryExpense: null, deliveryExpenseNote: 'старое значение' },
    })

    // Вызываем роут пересчёта
    const adminToken = app.jwt.sign({ userId: user.id, role: 'super_admin' })
    const recomputeRes = await app.inject({
      method: 'POST',
      url: `/api/admin/orders/${id}/delivery-expense/recompute`,
      headers: { authorization: `Bearer ${adminToken}` },
    })

    expect(recomputeRes.statusCode).toBe(200)
    const { deliveryExpense, deliveryExpenseNote } = recomputeRes.json()

    expect(deliveryExpense).toBe(0)
    expect(deliveryExpenseNote).toBeNull()
  })

  it('роут пересчёта возвращает 401 без токена', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/orders/fake-id/delivery-expense/recompute',
    })

    expect(res.statusCode).toBe(401)
  })

  it('роут пересчёта возвращает 404 на несуществующий заказ', async () => {
    const user = await createUser()
    const adminToken = app.jwt.sign({ userId: user.id, role: 'super_admin' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/orders/nonexistent-id/delivery-expense/recompute',
      headers: { authorization: `Bearer ${adminToken}` },
    })

    expect(res.statusCode).toBe(404)
  })
})
