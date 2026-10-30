import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import prismaPlugin from '../plugins/prisma.js'
import authenticatePlugin from '../plugins/authenticate.js'
import { ApiError, errorResponse } from '../lib/errors.js'
import { registerCommonSchemas } from '../schemas/common.js'
import cartRoutes from '../routes/cart/index.js'
import ordersRoutes from '../routes/orders/index.js'
import bonusRoutes from '../routes/bonus/index.js'
import { db, $Enums } from '../lib/db.js'
import { bonusService } from '../services/bonus.service.js'
import type { TelegramNotifier } from '../services/telegram/notifier.js'

const { sign } = jwt
const MAIL_DOMAIN = '@ps-bonus-test.local'
const CUSTOMER = { role: 'customer', proStatus: 'none' }
const RUN = crypto.randomUUID().slice(0, 8)
const RETAIL_PRICE = 300_000
const RECIPIENT = { name: 'Тест Бонусы', phone: '+79990000000' }

let app: FastifyInstance

async function build(): Promise<FastifyInstance> {
  const server = Fastify()
  registerCommonSchemas(server)
  await server.register(prismaPlugin)
  await server.register(cookie, { secret: process.env.PS_COOKIE_SECRET || 'test-secret', hook: 'preHandler' })
  await server.register(rateLimit, { max: 10000, timeWindow: '1 minute' })
  await server.register(authenticatePlugin)
  // Роут заказа шлёт уведомление после создания; в тесте достаточно заглушки
  server.decorate('telegram', { onNewOrder: async () => undefined } as unknown as TelegramNotifier)
  server.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send(errorResponse(error))
    console.error('ТЕСТ-500:', error)
    reply.status(500).send(errorResponse(new ApiError(500, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера')))
  })
  await server.register(cartRoutes)
  await server.register(ordersRoutes)
  await server.register(bonusRoutes)
  return server
}

async function setProgram(enabled: boolean): Promise<void> {
  await db.loyaltySettings.update({
    where: { id: 1 },
    data: {
      enabled,
      welcomeBonus: 0,
      kopecksPerBonus: 100,
      maxSpendPercent: 30,
      minOrderForSpend: 0,
      allowSpendWithPromo: false,
      accrualPercent: 5,
      accrualBase: 'paid_goods',
      accrualTrigger: 'delivered',
      accrualDelayDays: 0,
      excludeProfessionalProducts: true,
      accrueWithPromo: false,
    },
  })
}

async function cleanup(): Promise<void> {
  const users = await db.user.findMany({ where: { email: { endsWith: MAIL_DOMAIN } }, select: { id: true } })
  const userIds = users.map((u) => u.id)
  if (userIds.length > 0) {
    const accounts = await db.bonusAccount.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
    await db.bonusTransaction.deleteMany({ where: { accountId: { in: accounts.map((a) => a.id) } } })
    await db.bonusAccount.deleteMany({ where: { id: { in: accounts.map((a) => a.id) } } })
    await db.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } })
    await db.promoCodeRedemption.deleteMany({ where: { userId: { in: userIds } } })
    await db.order.deleteMany({ where: { userId: { in: userIds } } })
    await db.cart.deleteMany({ where: { userId: { in: userIds } } })
    await db.consentRecord.deleteMany({ where: { userId: { in: userIds } } })
    await db.otpCode.deleteMany({ where: { userId: { in: userIds } } })
    await db.user.deleteMany({ where: { id: { in: userIds } } })
  }
  await db.promoCode.deleteMany({ where: { code: { startsWith: `BT${RUN.toUpperCase()}` } } })
  await db.product.updateMany({ where: { slug: { startsWith: `bonus-${RUN}` } }, data: { isActive: false } })
}

async function makeUser(label: string, role: $Enums.UserRole = 'customer', proStatus: $Enums.ProStatus = 'none') {
  return db.user.create({
    data: { email: `${label}-${RUN}${MAIL_DOMAIN}`, name: `Тест ${label}`, role, proStatus },
  })
}

function tokenFor(user: { id: string; role: string; tokenVersion: number }): string {
  return sign({ userId: user.id, role: user.role, tv: user.tokenVersion }, process.env.JWT_SECRET || 'dev-secret')
}

async function makeVariant(label: string, stock: number, wholesalePrice: number | null = null): Promise<string> {
  const product = await db.product.create({
    data: {
      name: `Бонусы ${label}`,
      slug: `bonus-${RUN}-${label}-${crypto.randomUUID().slice(0, 6)}`,
      isActive: true,
      description: 'Тест бонусов',
      skinTypes: [],
      concerns: [],
    },
  })
  const variant = await db.productVariant.create({
    data: {
      productId: product.id,
      volumeValue: 50,
      volumeUnit: 'ml',
      retailPrice: RETAIL_PRICE,
      wholesalePrice,
      stock,
      isActive: true,
    },
  })
  return variant.id
}

async function addToCart(variantId: string, auth?: string, cookieHeader?: string): Promise<string | undefined> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/cart/items',
    payload: { variantId, quantity: 1 },
    headers: { ...(auth ? { authorization: `Bearer ${auth}` } : {}), ...(cookieHeader ? { cookie: cookieHeader } : {}) },
  })
  if (res.statusCode !== 201) throw new Error(`cart add failed: ${res.statusCode} ${res.body}`)
  return res.cookies.find((c) => c.name === 'ps_sid')?.value
}

async function member(label: string, balance: number, role: $Enums.UserRole = 'customer', proStatus: $Enums.ProStatus = 'none') {
  const user = await makeUser(label, role, proStatus)
  if (role === 'customer') {
    await bonusService.join(user.id, CUSTOMER, new Date())
    const account = await db.bonusAccount.findUniqueOrThrow({ where: { userId: user.id } })
    await db.bonusAccount.update({ where: { id: account.id }, data: { balance: { increment: balance } } })
    await db.bonusTransaction.create({
      data: { accountId: account.id, type: 'welcome', amount: balance, remaining: balance, expiresAt: null },
    })
  }
  return user
}

async function accountOf(userId: string) {
  return db.bonusAccount.findUniqueOrThrow({ where: { userId } })
}

async function balanceOf(userId: string): Promise<number> {
  return (await db.bonusAccount.findUniqueOrThrow({ where: { userId } })).balance
}

function placeOrder(token: string, payload: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/orders',
    payload: { deliveryMethod: 'pickup', recipient: RECIPIENT, ...payload },
    headers: { authorization: `Bearer ${token}` },
  })
}

function errorOf(body: string): { code: string; details?: Record<string, unknown> } {
  return JSON.parse(body).error
}

describe('Списание бонусов в заказе (HTTP)', () => {
  beforeAll(async () => {
    app = await build()
    await cleanup()
    await setProgram(true)
  })

  afterAll(async () => {
    await cleanup()
    await setProgram(false)
    await app.close()
  })

  it('заказ с бонусами: total за вычетом бонусов, журнал order_spend, блок bonus и прогноз начисления по paid_goods', async () => {
    const user = await member('spend-ok', 500)
    const token = tokenFor(await db.user.findUniqueOrThrow({ where: { id: user.id } }))
    const variantId = await makeVariant('spend-ok', 10)
    await addToCart(variantId, token)

    const res = await placeOrder(token, { bonusSpend: 100, expectedTotal: 290_000 })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.total).toBe(290_000)
    expect(body.bonus).toEqual({ spent: 100, discount: 10_000, accrualPlanned: 145, accrualStatus: 'pending' })
    expect(await balanceOf(user.id)).toBe(400)
    const spend = await db.bonusTransaction.findFirstOrThrow({ where: { orderId: body.id, type: 'order_spend' } })
    expect(spend.amount).toBe(-100)
    const order = await db.order.findUniqueOrThrow({ where: { id: body.id } })
    expect(order).toMatchObject({ bonusSpent: 100, bonusDiscount: 10_000, bonusAccrualPlanned: 145 })
  })

  it('expectedTotal без учёта бонусов → TOTAL_MISMATCH с bonusDiscount; заказ и списание откатываются', async () => {
    const user = await member('mismatch', 500)
    const token = tokenFor(await db.user.findUniqueOrThrow({ where: { id: user.id } }))
    const variantId = await makeVariant('mismatch', 10)
    await addToCart(variantId, token)
    const stockBefore = (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock

    const res = await placeOrder(token, { bonusSpend: 100, expectedTotal: RETAIL_PRICE })

    expect(res.statusCode).toBe(409)
    const error = errorOf(res.body)
    expect(error.code).toBe('TOTAL_MISMATCH')
    expect(error.details).toMatchObject({ bonusDiscount: 10_000, total: 290_000 })
    expect(await balanceOf(user.id)).toBe(500)
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(stockBefore)
  })

  it('гость с bonusSpend → BONUS_AUTH_REQUIRED', async () => {
    const variantId = await makeVariant('guest', 10)
    const sid = await addToCart(variantId)

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      payload: {
        deliveryMethod: 'pickup',
        recipient: { ...RECIPIENT, email: `guest-${RUN}${MAIL_DOMAIN}` },
        expectedTotal: 0,
        bonusSpend: 10,
      },
      headers: { cookie: `ps_sid=${sid}` },
    })

    expect(res.statusCode).toBe(409)
    expect(errorOf(res.body).code).toBe('BONUS_AUTH_REQUIRED')
  })

  it('одобренный специалист → BONUS_NOT_ELIGIBLE', async () => {
    const pro = await member('pro', 0, 'professional', 'approved')
    const token = tokenFor(await db.user.findUniqueOrThrow({ where: { id: pro.id } }))
    const variantId = await makeVariant('pro', 10, 200_000)
    await addToCart(variantId, token)

    const res = await placeOrder(token, { bonusSpend: 10, expectedTotal: 0 })

    expect(res.statusCode).toBe(409)
    expect(errorOf(res.body).code).toBe('BONUS_NOT_ELIGIBLE')
  })

  it('промокод при allowSpendWithPromo=false → BONUS_PROMO_CONFLICT', async () => {
    const user = await member('promo', 500)
    const token = tokenFor(await db.user.findUniqueOrThrow({ where: { id: user.id } }))
    const variantId = await makeVariant('promo', 10)
    await addToCart(variantId, token)
    await db.promoCode.create({
      data: { code: `BT${RUN.toUpperCase()}P1`, percent: 10, isActive: true, usedCount: 0, perUserLimit: false },
    })

    const res = await placeOrder(token, { promoCode: `BT${RUN}P1`, bonusSpend: 10, expectedTotal: 0 })

    expect(res.statusCode).toBe(409)
    expect(errorOf(res.body).code).toBe('BONUS_PROMO_CONFLICT')
  })

  it('выше лимита доли товаров → BONUS_LIMIT_EXCEEDED с maxSpend', async () => {
    const user = await member('limit', 2_000)
    const token = tokenFor(await db.user.findUniqueOrThrow({ where: { id: user.id } }))
    const variantId = await makeVariant('limit', 10)
    await addToCart(variantId, token)

    const res = await placeOrder(token, { bonusSpend: 901, expectedTotal: 0 })

    expect(res.statusCode).toBe(409)
    expect(errorOf(res.body)).toMatchObject({ code: 'BONUS_LIMIT_EXCEEDED', details: { maxSpend: 900 } })
  })

  it('программа выключена → BONUS_PROGRAM_DISABLED', async () => {
    const user = await member('disabled', 500)
    const token = tokenFor(await db.user.findUniqueOrThrow({ where: { id: user.id } }))
    const variantId = await makeVariant('disabled', 10)
    await addToCart(variantId, token)

    await setProgram(false)
    try {
      const res = await placeOrder(token, { bonusSpend: 10, expectedTotal: 0 })
      expect(res.statusCode).toBe(409)
      expect(errorOf(res.body).code).toBe('BONUS_PROGRAM_DISABLED')
    } finally {
      await setProgram(true)
    }
  })

  it('не участник → BONUS_NOT_MEMBER', async () => {
    const user = await makeUser('not-member')
    const token = tokenFor(user)
    const variantId = await makeVariant('not-member', 10)
    await addToCart(variantId, token)

    const res = await placeOrder(token, { bonusSpend: 10, expectedTotal: 0 })

    expect(res.statusCode).toBe(409)
    expect(errorOf(res.body).code).toBe('BONUS_NOT_MEMBER')
  })

  it('гонка по HTTP: два заказа одного участника на весь баланс — один 201, второй отказ, баланс и товар не испорчены', async () => {
    const user = await member('race', 20)
    const token = tokenFor(await db.user.findUniqueOrThrow({ where: { id: user.id } }))
    const variantId = await makeVariant('race', 50)
    await addToCart(variantId, token)
    const stockBefore = (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock

    const [first, second] = await Promise.all([
      placeOrder(token, { bonusSpend: 20, expectedTotal: RETAIL_PRICE - 2_000 }),
      placeOrder(token, { bonusSpend: 20, expectedTotal: RETAIL_PRICE - 2_000 }),
    ])

    const statuses = [first.statusCode, second.statusCode].sort()
    expect(statuses).toEqual([201, 409])
    const failed = first.statusCode === 409 ? first : second
    expect(['BONUS_INSUFFICIENT', 'CART_EMPTY']).toContain(errorOf(failed.body).code)
    expect(await balanceOf(user.id)).toBe(0)
    expect(await db.bonusTransaction.count({ where: { accountId: (await accountOf(user.id)).id, type: 'order_spend' } })).toBe(1)
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(stockBefore - 1)
  })

  it('GET /bonus/checkout: лимит и прогноз начисления по корзине; гость получает AUTH_REQUIRED', async () => {
    const user = await member('quote', 2_000)
    const token = tokenFor(await db.user.findUniqueOrThrow({ where: { id: user.id } }))
    const variantId = await makeVariant('quote', 10)
    await addToCart(variantId, token)
    const guestSid = await addToCart(variantId)

    const memberRes = await app.inject({
      method: 'GET',
      url: '/api/v1/bonus/checkout?spend=100',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(memberRes.statusCode).toBe(200)
    expect(memberRes.headers['cache-control']).toBe('no-store')
    expect(JSON.parse(memberRes.body)).toEqual({
      canSpend: true,
      reason: null,
      available: 2_000,
      maxSpend: 900,
      kopecksPerBonus: 100,
      goodsAfterDiscount: RETAIL_PRICE,
      minOrderForSpend: 0,
      accrualPreview: 145,
    })

    const guest = await app.inject({
      method: 'GET',
      url: '/api/v1/bonus/checkout',
      headers: { cookie: `ps_sid=${guestSid}` },
    })
    expect(guest.statusCode).toBe(200)
    expect(JSON.parse(guest.body)).toMatchObject({ canSpend: false, reason: 'AUTH_REQUIRED' })
  })
})
