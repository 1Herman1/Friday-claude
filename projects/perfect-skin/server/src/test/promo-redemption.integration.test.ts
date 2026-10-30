import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { FastifyBaseLogger } from 'fastify'
import { db } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'
import { orderService } from '../services/order.service.js'

const EMAIL_DOMAIN = '@promo-race.ps-test.local'
const PARALLEL_ORDERS = 5
const PRICE_KOP = 100_000
const PERCENT = 15
const EXPECTED_TOTAL = PRICE_KOP - (PRICE_KOP * PERCENT) / 100

const silentLog = { warn: () => {} } as Pick<FastifyBaseLogger, 'warn'>

const suffix = randomUUID().slice(0, 8)
const code = `RACE${suffix.toUpperCase()}`

let productId: string
const variantIds: string[] = []
let promoId: string
const userIds: string[] = []

beforeAll(async () => {
  const product = await db.product.create({
    data: {
      name: 'Promo race',
      slug: `promo-race-${suffix}`,
      description: 'Товар для гонки промокода',
      isActive: true,
      skinTypes: [],
      concerns: [],
    },
  })
  productId = product.id

  // Каждый покупатель — свой вариант: общая строка остатков сериализовала бы заказы до шага с промокодом
  for (let i = 0; i < PARALLEL_ORDERS; i += 1) {
    const variant = await db.productVariant.create({
      data: { productId, volumeValue: 50 + i, volumeUnit: 'ml', retailPrice: PRICE_KOP, stock: 100, isActive: true },
    })
    variantIds.push(variant.id)
  }

  const promo = await db.promoCode.create({
    data: { code, percent: PERCENT, maxRedemptions: 1, usedCount: 0, isActive: true },
  })
  promoId = promo.id

  for (let i = 0; i < PARALLEL_ORDERS; i += 1) {
    const user = await db.user.create({
      data: { name: `Race ${i}`, email: `race-${suffix}-${i}${EMAIL_DOMAIN}`, role: 'customer' },
    })
    userIds.push(user.id)
    await db.cart.create({
      data: { userId: user.id, items: { create: [{ productId, productVariantId: variantIds[i], quantity: 1 }] } },
    })
  }
})

afterAll(async () => {
  await db.promoCodeRedemption.deleteMany({ where: { promoCodeId: promoId } })
  await db.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } })
  await db.order.deleteMany({ where: { userId: { in: userIds } } })
  await db.cart.deleteMany({ where: { userId: { in: userIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await db.promoCode.deleteMany({ where: { id: promoId } })
  await db.product.deleteMany({ where: { id: productId } })
})

describe('промокод с лимитом: гонка за последнее применение', () => {
  it('параллельные заказы на последнее применение → оформляет один, остальные PROMO_EXHAUSTED', async () => {
    const results = await Promise.allSettled(
      userIds.map((userId) =>
        orderService.createOrder(
          { customerId: userId, cart: { userId } },
          {
            deliveryMethod: 'pickup',
            recipient: { name: 'Тест', phone: '+79990000002' },
            promoCode: code,
            expectedTotal: EXPECTED_TOTAL,
          },
          null,
          silentLog
        )
      )
    )

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(PARALLEL_ORDERS - 1)
    for (const failure of rejected) {
      expect(failure.reason).toBeInstanceOf(ApiError)
      expect((failure.reason as ApiError).code).toBe('PROMO_EXHAUSTED')
    }

    const promo = await db.promoCode.findUniqueOrThrow({ where: { id: promoId } })
    expect(promo.usedCount).toBe(1)
    expect(await db.promoCodeRedemption.count({ where: { promoCodeId: promoId } })).toBe(1)
  })
})
