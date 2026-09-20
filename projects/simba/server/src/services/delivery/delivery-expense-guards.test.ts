import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { computeDeliveryExpense } from './delivery-expense.js'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from '../../test/setup.js'
import { createUser, createProductWithVariant, createCart, authHeader, seedDeliveryOptions } from '../../test/factories.js'

// Расчёт расхода — фоновая операция после создания заказа. Любой её сбой
// должен оставаться сбоем расчёта, а не отменять оплаченный заказ.
describe.skipIf(!hasTestDb)('computeDeliveryExpense — устойчивость', () => {
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

  async function createCourierOrder() {
    const { variant } = await createProductWithVariant({ price: 100000, stock: 5, weight: 1 })
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
    // Создание заказа запускает фоновый расчёт расхода (order.service.ts, void
    // computeDeliveryExpense). Если не дождаться его, запись прилетит уже во
    // время TRUNCATE следующего теста и обе стороны поймают дедлок.
    await new Promise((r) => setTimeout(r, 200))
    return res.json().id as string
  }

  it('несуществующий заказ не роняет расчёт', async () => {
    await expect(
      computeDeliveryExpense(getTestPrisma(), '00000000-0000-0000-0000-000000000000')
    ).resolves.toBeUndefined()
  })

  it('выключенный справочник курьера пишет заметку, а не исключение', async () => {
    const prisma = getTestPrisma()
    const orderId = await createCourierOrder()

    await prisma.deliveryOption.update({
      where: { key: 'simba_courier' },
      data: { isActive: false },
    })

    await computeDeliveryExpense(prisma, orderId)

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { deliveryExpense: true, deliveryExpenseNote: true, deliveryCost: true, total: true },
    })

    expect(order.deliveryExpense).toBeNull()
    expect(order.deliveryExpenseNote).toContain('simba_courier')
    // Цена для покупателя не тронута сбоем внутреннего расчёта
    expect(order.deliveryCost).toBe(70000)
  })

  it('повторный расчёт идемпотентен: значение и заметка не накапливаются', async () => {
    const prisma = getTestPrisma()
    const orderId = await createCourierOrder()

    await computeDeliveryExpense(prisma, orderId)
    const first = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { deliveryExpense: true, deliveryExpenseNote: true },
    })

    await computeDeliveryExpense(prisma, orderId)
    const second = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { deliveryExpense: true, deliveryExpenseNote: true },
    })

    expect(first.deliveryExpense).toBe(25000)
    expect(second).toEqual(first)
  })

  it('после сбоя удачный пересчёт стирает старую заметку', async () => {
    const prisma = getTestPrisma()
    const orderId = await createCourierOrder()

    await prisma.deliveryOption.update({ where: { key: 'simba_courier' }, data: { isActive: false } })
    await computeDeliveryExpense(prisma, orderId)

    await prisma.deliveryOption.update({ where: { key: 'simba_courier' }, data: { isActive: true } })
    await computeDeliveryExpense(prisma, orderId)

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { deliveryExpense: true, deliveryExpenseNote: true },
    })

    expect(order.deliveryExpense).toBe(25000)
    expect(order.deliveryExpenseNote).toBeNull()
  })
})
