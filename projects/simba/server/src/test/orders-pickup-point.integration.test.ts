import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createUser, createProductWithVariant, createCart, authHeader, seedDeliveryOptions } from './factories'

// Цены из таблицы delivery_options
const PVZ_PRICE = 9900 // cdek_pvz цена

const point = {
  provider: 'cdek' as const,
  code: 'MSK-42',
  name: 'ПВЗ на Тверской',
  address: 'Москва, ул. Тверская, 1',
  lat: 55.7601,
  lon: 37.6156,
  workTime: 'пн–пт 10:00–20:00',
  phone: '+74951234567',
}

describe.skipIf(!hasTestDb)('Заказ в пункт выдачи СДЭК (интеграционные)', () => {
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

  it('cdek + пункт выдачи и город без улицы → 201, пункт сохранён в заказе целиком', async () => {
    const prisma = getTestPrisma()
    const { variant } = await createProductWithVariant({ price: 100000, stock: 10, weight: 2.5 })
    const user = await createUser()
    const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 2 }])

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(app, user.id),
      payload: {
        cartId: cart.id,
        deliveryMethod: 'cdek',
        deliveryAddress: { city: 'Москва' },
        deliveryPoint: point,
        hasSpecialPackaging: false,
        deliveryCost: PVZ_PRICE,
      },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().deliveryPoint).toEqual(point)

    const row = await prisma.order.findFirstOrThrow()
    expect(row.deliveryPoint).toEqual(point)
    // cdek и yandex сохраняют только город в deliveryAddress для расчёта расходов доставки
    expect(row.deliveryAddress).toEqual({ city: 'Москва' })
    expect(row.deliveryMethod).toBe('cdek')
    expect(row.deliveryCost).toBe(PVZ_PRICE)
    expect(row.total).toBe(row.subtotal + PVZ_PRICE - row.bonusUsed)
  })

  it('заниженная клиентом стоимость доставки → 409 DELIVERY_COST_CHANGED, заказа нет', async () => {
    const prisma = getTestPrisma()
    const { variant } = await createProductWithVariant({ price: 100000, stock: 10, weight: 1 })
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
        deliveryPoint: point,
        hasSpecialPackaging: false,
        deliveryCost: 0,
      },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe('DELIVERY_COST_CHANGED')
    expect(res.json().actualDeliveryCost).toBe(PVZ_PRICE)
    expect(await prisma.order.count()).toBe(0)
  })

  it('cdek без пункта выдачи возвращает ошибку 400', async () => {
    const prisma = getTestPrisma()
    const { variant } = await createProductWithVariant({ price: 100000, stock: 10, weight: 1 })
    const user = await createUser()
    const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 1 }])

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(app, user.id),
      payload: {
        cartId: cart.id,
        deliveryMethod: 'cdek',
        deliveryAddress: { city: 'Москва', street: 'ул. Тверская', house: '1' },
        hasSpecialPackaging: false,
        deliveryCost: PVZ_PRICE,
      },
    })

    // СДЭК доставляет только в пункт выдачи — без пункта ошибка
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/пункт выдачи/i)

    expect(await prisma.order.count()).toBe(0)
  })
})
