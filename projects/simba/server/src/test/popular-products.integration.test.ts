import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { hasTestDb, skipReason, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createProductWithVariant, createUser } from './factories'

describe.skipIf(!hasTestDb)('Популярные товары (интеграционные)', () => {
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
  })

  it('возвращает товары с наибольшими продажами за последние 60 дней', async () => {
    const prisma = getTestPrisma()

    // Создаём товары
    // Товаров с продажами нужно минимум ЧЕТЫРЕ: при меньшем числе сервис
    // (popular-products.service.ts:81) переходит на подобранный набор и
    // отвечает basis 'curated'. Прежняя версия теста заводила три и ждала
    // 'sales' — то есть противоречила правилу, которое проверяет соседний тест.
    const { product: p1, variant: v1 } = await createProductWithVariant()
    const { product: p2, variant: v2 } = await createProductWithVariant()
    const { product: p3, variant: v3 } = await createProductWithVariant()
    const { product: p4, variant: v4 } = await createProductWithVariant()

    // Создаём пользователя и заказы
    const user = await createUser()

    // Заказ 1: товар 1 (5 шт) и товар 2 (3 шт)
    const order1 = await prisma.order.create({
      data: {
        userId: user.id,
        status: 'confirmed',
        deliveryMethod: 'cdek',
        subtotal: 200000,
        total: 200000,
      },
    })

    await prisma.orderItem.create({
      data: {
        orderId: order1.id,
        productId: p1.id,
        productVariantId: v1.id,
        productName: p1.name,
        variantWeight: v1.weight,
        price: 10000,
        quantity: 5,
      },
    })

    await prisma.orderItem.create({
      data: {
        orderId: order1.id,
        productId: p2.id,
        productVariantId: v2.id,
        productName: p2.name,
        variantWeight: v2.weight,
        price: 10000,
        quantity: 3,
      },
    })

    // Заказ 2: товар 3 (1 шт)
    const order2 = await prisma.order.create({
      data: {
        userId: user.id,
        status: 'in_transit',
        deliveryMethod: 'cdek',
        subtotal: 100000,
        total: 100000,
      },
    })

    await prisma.orderItem.create({
      data: {
        orderId: order2.id,
        productId: p3.id,
        productVariantId: v3.id,
        productName: p3.name,
        variantWeight: v3.weight,
        price: 10000,
        quantity: 1,
      },
    })

    // Четвёртый товар — тоже с продажей, но самой слабой: порядок выдачи
    // от него не зависит, он нужен, чтобы базис стал 'sales'.
    await prisma.orderItem.create({
      data: {
        orderId: order2.id,
        productId: p4.id,
        productVariantId: v4.id,
        productName: p4.name,
        variantWeight: v4.weight,
        price: 10000,
        quantity: 1,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/products/popular?limit=8',
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.basis).toBe('sales')
    expect(body.items.length).toBeGreaterThan(0)
    // Товар 1 должен быть первым (5 продаж)
    expect(body.items[0].id).toBe(p1.id)
  })

  it('не учитывает заказы со статусом cancelled', async () => {
    const prisma = getTestPrisma()

    const { product, variant } = await createProductWithVariant()
    const user = await createUser()

    // Отменённый заказ
    const cancelledOrder = await prisma.order.create({
      data: {
        userId: user.id,
        status: 'cancelled',
        deliveryMethod: 'cdek',
        subtotal: 100000,
        total: 100000,
      },
    })

    await prisma.orderItem.create({
      data: {
        orderId: cancelledOrder.id,
        productId: product.id,
        productVariantId: variant.id,
        productName: product.name,
        variantWeight: variant.weight,
        price: 10000,
        quantity: 10,
      },
    })

    // Четыре товара с настоящими продажами. Без них базис скатывается в
    // 'curated', а подобранный набор добирает витрину ЛЮБЫМ товаром с остатком
    // (popular-products.service.ts:113-126) — в том числе нашим отменённым.
    // Тогда тест падал бы, ничего не сообщая о самих отменённых заказах.
    const paidOrder = await prisma.order.create({
      data: {
        userId: user.id,
        status: 'confirmed',
        deliveryMethod: 'cdek',
        subtotal: 400000,
        total: 400000,
      },
    })

    for (let i = 0; i < 4; i++) {
      const sold = await createProductWithVariant()
      await prisma.orderItem.create({
        data: {
          orderId: paidOrder.id,
          productId: sold.product.id,
          productVariantId: sold.variant.id,
          productName: sold.product.name,
          variantWeight: sold.variant.weight,
          price: 10000,
          quantity: 2,
        },
      })
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/products/popular?limit=8',
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.basis).toBe('sales')
    // Товар не должен быть в результате т.к. статус cancelled
    expect(body.items.some((p: any) => p.id === product.id)).toBe(false)
  })

  it('дополняет featured товарами если продаж мало', async () => {
    const prisma = getTestPrisma()

    // Товар с одной продажей
    const { product: soldProduct, variant: soldVariant } = await createProductWithVariant()

    // Featured товары
    const featured1 = await prisma.product.create({
      data: {
        name: 'Featured 1',
        slug: 'featured-1',
        description: 'Test',
        isActive: true,
        images: ['test.jpg'],
        isFeatured: true,
        variants: {
          create: { weight: 1.5, price: 10000, stock: 10, isActive: true },
        },
      },
    })

    const featured2 = await prisma.product.create({
      data: {
        name: 'Featured 2',
        slug: 'featured-2',
        description: 'Test',
        isActive: true,
        images: ['test.jpg'],
        isFeatured: true,
        variants: {
          create: { weight: 1.5, price: 10000, stock: 10, isActive: true },
        },
      },
    })

    const user = await createUser()

    // Один заказ с одной позицией
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        status: 'delivered',
        deliveryMethod: 'cdek',
        subtotal: 100000,
        total: 100000,
      },
    })

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: soldProduct.id,
        productVariantId: soldVariant.id,
        productName: soldProduct.name,
        variantWeight: soldVariant.weight,
        price: 10000,
        quantity: 1,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/products/popular?limit=8',
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    // Базис должен быть curated т.к. продаж < 4
    expect(body.basis).toBe('curated')
    // Featured товары должны быть в результате
    expect(body.items.some((p: any) => [featured1.id, featured2.id].includes(p.id))).toBe(true)
  })

  it('возвращает базис sales только когда минимум 4 товара с продажами', async () => {
    const prisma = getTestPrisma()

    // 4 товара с продажами
    const { product: p1, variant: v1 } = await createProductWithVariant()
    const { product: p2, variant: v2 } = await createProductWithVariant()
    const { product: p3, variant: v3 } = await createProductWithVariant()
    const { product: p4, variant: v4 } = await createProductWithVariant()

    const user = await createUser()

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        status: 'confirmed',
        deliveryMethod: 'cdek',
        subtotal: 400000,
        total: 400000,
      },
    })

    for (const [p, v] of [[p1, v1], [p2, v2], [p3, v3], [p4, v4]]) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: (p as any).id,
          productVariantId: (v as any).id,
          productName: (p as any).name,
          variantWeight: (v as any).weight,
          price: 10000,
          quantity: 1,
        },
      })
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/products/popular?limit=8',
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.basis).toBe('sales')
    expect(body.items.length).toBe(4)
  })
})
