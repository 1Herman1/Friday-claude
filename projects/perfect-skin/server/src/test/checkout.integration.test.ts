import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import jwt from 'jsonwebtoken'
const { sign } = jwt
import prismaPlugin from '../plugins/prisma.js'
import authenticatePlugin from '../plugins/authenticate.js'
import { ApiError, errorResponse } from '../lib/errors.js'
import { registerCommonSchemas } from '../schemas/common.js'
import cartRoutes from '../routes/cart/index.js'
import promoRoutes from '../routes/promo/index.js'
import deliveryRoutes from '../routes/delivery/index.js'
import ordersRoutes from '../routes/orders/index.js'
import authRoutes from '../routes/auth/index.js'
import { db } from '../lib/db.js'
import crypto from 'crypto'

let app: FastifyInstance

async function build() {
  const app = Fastify()

  registerCommonSchemas(app)

  await app.register(prismaPlugin)
  await app.register(cookie, {
    secret: process.env.PS_COOKIE_SECRET || 'test-secret',
    hook: 'preHandler',
  })
  await app.register(cors, {
    origin: 'http://localhost:3000',
    credentials: true,
  })
  await app.register(rateLimit, {
    max: 10000,
    timeWindow: '1 minute',
  })
  await app.register(authenticatePlugin)

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.status).send(errorResponse(error))
    }

    app.log.error({ error, requestId: request.id })
    console.error('ТЕСТ-500:', error)
    reply.status(500).send(
      errorResponse(
        new ApiError(500, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера')
      )
    )
  })

  await app.register(cartRoutes)
  await app.register(promoRoutes)
  await app.register(deliveryRoutes)
  await app.register(ordersRoutes)
  await app.register(authRoutes)

  return app
}

describe('Checkout Integration Tests', () => {
  beforeAll(async () => {
    app = await build()
    // Остатки прошлых прогонов: тестовые пользователи (test-*@ps-test.local) с их заказами
    // и корзинами ломают повторный запуск уникальностью email.
    const stale = await db.user.findMany({ where: { email: { endsWith: '@ps-test.local' } }, select: { id: true } })
    const ids = stale.map((u) => u.id)
    if (ids.length) {
      await db.orderItem.deleteMany({ where: { order: { userId: { in: ids } } } })
      await db.promoCodeRedemption.deleteMany({ where: { userId: { in: ids } } })
      await db.order.deleteMany({ where: { userId: { in: ids } } })
      await db.cart.deleteMany({ where: { userId: { in: ids } } })
      await db.otpCode.deleteMany({ where: { userId: { in: ids } } })
      await db.user.deleteMany({ where: { id: { in: ids } } })
    }
    // Тесты покупают из общего сида — вернуть остатки, чтобы прогоны не голодали.
    await db.productVariant.updateMany({ data: { stock: 10 } })
  })

  afterAll(async () => {
    // Тестовые товары гонки не должны утекать в каталог витрины.
    await db.product.updateMany({
      where: { slug: { startsWith: 'race-' } },
      data: { isActive: false },
    })
    await app.close()
  })

  // (a) Guest gets cart from cookie, adds item → item appears
  it('(a) Guest receives cart via cookie and can add items', async () => {
    // Get a product to test with
    const product = await db.product.findFirst({
      where: {
        isActive: true,
        deletedAt: null,
        variants: {
          some: {
            isActive: true,
            deletedAt: null,
            retailPrice: { gt: 0 },
          },
        },
      },
      include: {
        variants: {
          where: {
            isActive: true,
            deletedAt: null,
          },
          take: 1,
        },
      },
    })

    expect(product).toBeDefined()
    expect(product!.variants.length).toBeGreaterThan(0)

    const variant = product!.variants[0]

    // POST /cart/items - add item without auth
    const addResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      payload: {
        variantId: variant.id,
        quantity: 1,
      },
    })

    expect(addResponse.statusCode).toBe(201)
    const addData = JSON.parse(addResponse.body)
    expect(addData.id).toBeDefined()
    expect(addData.items).toHaveLength(1)
    expect(addData.items[0].variantId).toBe(variant.id)
    expect(addData.items[0].quantity).toBe(1)

    // Extract session cookie
    const setCookie = ([] as string[]).concat(addResponse.headers['set-cookie'] as any || [])
    const sessionCookie = setCookie?.find((c) => c.includes('ps_sid'))
    expect(sessionCookie).toBeDefined()

    // GET /cart with cookie - should have item
    const getResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/cart',
      headers: {
        cookie: sessionCookie!.split(';')[0],
      },
    })

    expect(getResponse.statusCode).toBe(200)
    const cartData = JSON.parse(getResponse.body)
    expect(cartData.items).toHaveLength(1)
    expect(cartData.itemsCount).toBe(1)
    expect(cartData.subtotal).toBeGreaterThan(0)
  })

  // (b) verify-otp merges guest cart
  it('(b) verify-otp merges guest cart into user cart', async () => {
    const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@ps-test.local`
    const code = '123456'

    // Create guest cart with item
    const product = await db.product.findFirst({
      where: {
        isActive: true,
        deletedAt: null,
        variants: {
          some: {
            isActive: true,
            deletedAt: null,
            retailPrice: { gt: 0 },
          },
        },
      },
      include: {
        variants: {
          where: { isActive: true, deletedAt: null },
          take: 1,
        },
      },
    })

    expect(product).toBeDefined()
    const variant = product!.variants[0]

    // Add item to guest cart
    const addResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      payload: { variantId: variant.id, quantity: 2 },
    })

    const setCookie = ([] as string[]).concat(addResponse.headers['set-cookie'] as any || [])
    const sessionCookie = setCookie?.find((c) => c.includes('ps_sid'))?.split(';')[0]

    // Пользователь сначала: OtpCode ссылается на userId
    const otpUser = (await db.user.findFirst({ where: { email } })) ??
      (await db.user.create({ data: { email, name: 'Test User', role: 'customer' } }))
    const codeHash = require('bcryptjs').hashSync(code, 10)
    await db.otpCode.create({
      data: {
        userId: otpUser.id,
        codeHash,
        channel: 'email',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    })

    // verify-otp
    const verifyResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      headers: {
        cookie: sessionCookie || '',
      },
      payload: { email, code },
    })

    expect(verifyResponse.statusCode).toBe(200)
    const verifyData = JSON.parse(verifyResponse.body)
    expect(verifyData.token).toBeDefined()
    expect(verifyData.cartMerged).toBe(true)

    // GET /cart with new token - should have merged item
    const token = verifyData.token
    const cartResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/cart',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(cartResponse.statusCode).toBe(200)
    const cartData = JSON.parse(cartResponse.body)
    expect(cartData.items.length).toBeGreaterThan(0)
    expect(cartData.items[0].quantity).toBe(2)
  })

  // (c) Order: stock deduction, clear cart, retry = CART_EMPTY
  it('(c) Create order deducts stock, clears cart, retry returns CART_EMPTY', async () => {
    const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@ps-test.local`
    const user =
      (await db.user.findFirst({ where: { email } })) ??
      (await db.user.create({ data: { email, name: 'Order Test User', role: 'customer' } }))

    const token = sign(
      { userId: user.id, role: user.role, tv: user.tokenVersion },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    )

    // Get product with stock
    const product = await db.product.findFirst({
      where: {
        isActive: true,
        deletedAt: null,
        variants: {
          some: {
            isActive: true,
            stock: { gte: 1 },
          },
        },
      },
      include: {
        variants: {
          where: { isActive: true, stock: { gte: 1 } },
          take: 1,
        },
      },
    })

    expect(product).toBeDefined()
    const variant = product!.variants[0]
    const initialStock = variant.stock

    // Add item to cart
    const addResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      payload: { variantId: variant.id, quantity: 1 },
      headers: { authorization: `Bearer ${token}` },
    })

    expect(addResponse.statusCode).toBe(201)

    // Get cart to get totals
    const cartResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/cart',
      headers: { authorization: `Bearer ${token}` },
    })

    const cartData = JSON.parse(cartResponse.body)
    expect(cartData.subtotal).toBeGreaterThan(0)

    // Create order
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      payload: {
        deliveryMethod: 'pickup',
        recipient: { name: 'Test User', phone: '+79999999999' },
        expectedTotal: cartData.subtotal,
      },
      headers: { authorization: `Bearer ${token}` },
    })

    expect(orderResponse.statusCode).toBe(201)
    const orderData = JSON.parse(orderResponse.body)
    expect(orderData.number).toMatch(/^PS-\d{6}$/)
    expect(orderData.total).toBe(cartData.subtotal)

    // Check stock was deducted
    const variantAfter = await db.productVariant.findUnique({
      where: { id: variant.id },
    })
    expect(variantAfter!.stock).toBe(initialStock - 1)

    // Get cart - should be empty
    const emptyCartResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/cart',
      headers: { authorization: `Bearer ${token}` },
    })

    const emptyData = JSON.parse(emptyCartResponse.body)
    expect(emptyData.items).toHaveLength(0)
    expect(emptyData.subtotal).toBe(0)

    // Retry order - should get CART_EMPTY
    const retryResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      payload: {
        deliveryMethod: 'pickup',
        recipient: { name: 'Test User', phone: '+79999999999' },
        expectedTotal: cartData.subtotal,
      },
      headers: { authorization: `Bearer ${token}` },
    })

    expect(retryResponse.statusCode).toBe(409)
    const retryData = JSON.parse(retryResponse.body)
    expect(retryData.error.code).toBe('CART_EMPTY')
  })

  // (d) RACE: two parallel orders on variant[stock=1] → one succeeds, other OUT_OF_STOCK
  it('(d) Race condition: two parallel orders on stock=1 variant', async () => {
    // Create a variant with exactly stock=1
    const raceProduct = await db.product.create({
      data: {
        name: 'Race Test Product',
        slug: `race-${Date.now()}`,
        isActive: true,
        description: 'Test product for race condition',
        skinTypes: [],
        concerns: [],
      },
    })

    const raceVariant = await db.productVariant.create({
      data: {
        productId: raceProduct.id,
        volumeValue: 50,
        volumeUnit: 'ml',
        retailPrice: 100000,
        stock: 1,
        isActive: true,
      },
    })

    // Create two users
    const user1 = await db.user.create({
      data: { email: `test-${Date.now()}-1@ps-test.local`, name: 'User 1', role: 'customer' },
    })
    const user2 = await db.user.create({
      data: { email: `test-${Date.now()}-2@ps-test.local`, name: 'User 2', role: 'customer' },
    })

    const token1 = sign(
      { userId: user1.id, role: user1.role, tv: user1.tokenVersion },
      process.env.JWT_SECRET || 'dev-secret'
    )
    const token2 = sign(
      { userId: user2.id, role: user2.role, tv: user2.tokenVersion },
      process.env.JWT_SECRET || 'dev-secret'
    )

    // Add item to both carts
    await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      payload: { variantId: raceVariant.id, quantity: 1 },
      headers: { authorization: `Bearer ${token1}` },
    })

    await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      payload: { variantId: raceVariant.id, quantity: 1 },
      headers: { authorization: `Bearer ${token2}` },
    })

    // Execute both orders in parallel
    const [response1, response2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/v1/orders',
        payload: {
          deliveryMethod: 'pickup',
          recipient: { name: 'User 1', phone: '+79998888888' },
          expectedTotal: 100000,
        },
        headers: { authorization: `Bearer ${token1}` },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/orders',
        payload: {
          deliveryMethod: 'pickup',
          recipient: { name: 'User 2', phone: '+79997777777' },
          expectedTotal: 100000,
        },
        headers: { authorization: `Bearer ${token2}` },
      }),
    ])

    // One should succeed (201), one should fail (409 OUT_OF_STOCK)
    const codes = [response1.statusCode, response2.statusCode].sort()
    expect(codes).toEqual([201, 409])

    const failedBody = JSON.parse(
      response1.statusCode === 409 ? response1.body : response2.body
    )
    expect(failedBody.error.code).toBe('OUT_OF_STOCK')

    // Stock should be 0
    const variantAfter = await db.productVariant.findUnique({
      where: { id: raceVariant.id },
    })
    expect(variantAfter!.stock).toBe(0)
  })

  // (e) TOTAL_MISMATCH if expectedTotal ≠ calculated
  it('(e) TOTAL_MISMATCH when expectedTotal differs from calculated', async () => {
    const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@ps-test.local`
    const user = await db.user.create({
      data: { email, name: 'Mismatch Test', role: 'customer' },
    })

    const token = sign(
      { userId: user.id, role: user.role, tv: user.tokenVersion },
      process.env.JWT_SECRET || 'dev-secret'
    )

    // Get product
    const product = await db.product.findFirst({
      where: {
        isActive: true,
        deletedAt: null,
        variants: { some: { isActive: true, stock: { gte: 1 } } },
      },
      include: {
        variants: { where: { isActive: true }, take: 1 },
      },
    })

    const variant = product!.variants[0]

    // Add to cart
    const addResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      payload: { variantId: variant.id, quantity: 1 },
      headers: { authorization: `Bearer ${token}` },
    })

    const cartData = JSON.parse(addResponse.body)
    const correctTotal = cartData.subtotal

    // Try to create order with wrong expectedTotal
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      payload: {
        deliveryMethod: 'pickup',
        recipient: { name: 'Test', phone: '+79999999999' },
        expectedTotal: correctTotal + 10000, // Wrong amount
      },
      headers: { authorization: `Bearer ${token}` },
    })

    expect(orderResponse.statusCode).toBe(409)
    const orderData = JSON.parse(orderResponse.body)
    expect(orderData.error.code).toBe('TOTAL_MISMATCH')
    expect(orderData.error.details.total).toBeDefined()
  })

  // (f) Promo: PROMO_NOT_FOUND for nonexistent + expired codes
  it('(f) Promo validation: PROMO_NOT_FOUND for nonexistent and expired codes', async () => {
    const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@ps-test.local`
    const user = await db.user.create({
      data: { email, name: 'Promo Test', role: 'customer' },
    })

    const token = sign(
      { userId: user.id, role: user.role, tv: user.tokenVersion },
      process.env.JWT_SECRET || 'dev-secret'
    )

    // Add item to cart
    const product = await db.product.findFirst({
      where: {
        isActive: true,
        deletedAt: null,
        variants: { some: { isActive: true, stock: { gte: 1 } } },
      },
      include: {
        variants: { where: { isActive: true }, take: 1 },
      },
    })

    const variant = product!.variants[0]

    await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      payload: { variantId: variant.id, quantity: 1 },
      headers: { authorization: `Bearer ${token}` },
    })

    // Test nonexistent code
    const nonexistResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/promo/validate',
      payload: { code: 'NONEXIST' },
      headers: { authorization: `Bearer ${token}` },
    })

    expect(nonexistResponse.statusCode).toBe(404)
    expect(JSON.parse(nonexistResponse.body).error.code).toBe('PROMO_NOT_FOUND')

    // Create and expire a promo
    const expiredCode = 'EXPIRED' + Date.now()
    const expiredPromo = await db.promoCode.create({
      data: {
        code: expiredCode,
        percent: 10,
        isActive: true,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      },
    })

    const expiredResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/promo/validate',
      payload: { code: expiredCode },
      headers: { authorization: `Bearer ${token}` },
    })

    expect(expiredResponse.statusCode).toBe(404)
    expect(JSON.parse(expiredResponse.body).error.code).toBe('PROMO_NOT_FOUND')
  })

  // (g) Guest checkout: add item without auth, create order with email
  it('(g) Guest checkout: add item, create order with email, verify OTP', async () => {
    const guestEmail = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@ps-test.local`
    const code = '123456'

    // Get a product
    const product = await db.product.findFirst({
      where: {
        isActive: true,
        deletedAt: null,
        variants: {
          some: {
            isActive: true,
            stock: { gte: 1 },
            retailPrice: { gt: 0 },
          },
        },
      },
      include: {
        variants: {
          where: { isActive: true, stock: { gte: 1 } },
          take: 1,
        },
      },
    })

    expect(product).toBeDefined()
    const variant = product!.variants[0]

    // Guest adds item (no auth)
    const addResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      payload: { variantId: variant.id, quantity: 1 },
    })

    expect(addResponse.statusCode).toBe(201)
    const setCookie = ([] as string[]).concat(addResponse.headers['set-cookie'] as any || [])
    const sessionCookie = setCookie?.find((c) => c.includes('ps_sid'))?.split(';')[0]
    expect(sessionCookie).toBeDefined()

    // Get cart for totals
    const cartResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/cart',
      headers: { cookie: sessionCookie! },
    })

    const cartData = JSON.parse(cartResponse.body)
    expect(cartData.subtotal).toBeGreaterThan(0)

    // Guest creates order with email
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: { cookie: sessionCookie! },
      payload: {
        deliveryMethod: 'pickup',
        recipient: { name: 'Guest User', phone: '+79999999999', email: guestEmail },
        expectedTotal: cartData.subtotal,
      },
    })

    expect(orderResponse.statusCode).toBe(201)
    const orderData = JSON.parse(orderResponse.body)
    expect(orderData.number).toMatch(/^PS-\d{6}$/)
    expect(orderData.total).toBe(cartData.subtotal)
    const orderId = orderData.id

    // Verify OTP on guest email
    const guestUser = await db.user.findFirst({ where: { email: guestEmail } })
    expect(guestUser).toBeDefined()

    // Create OTP code for guest
    const codeHash = require('bcryptjs').hashSync(code, 10)
    await db.otpCode.create({
      data: {
        userId: guestUser!.id,
        codeHash,
        channel: 'email',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    })

    // Verify OTP
    const verifyResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      payload: { email: guestEmail, code },
    })

    expect(verifyResponse.statusCode).toBe(200)
    const verifyData = JSON.parse(verifyResponse.body)
    const token = verifyData.token

    // GET /orders with token should show the order
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/orders',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(listResponse.statusCode).toBe(200)
    const listData = JSON.parse(listResponse.body)
    expect(listData.items.some((o: any) => o.id === orderId)).toBe(true)
  })

  // (h) Guest order without email → EMAIL_REQUIRED
  it('(h) Guest order without email returns EMAIL_REQUIRED', async () => {
    // Get a product
    const product = await db.product.findFirst({
      where: {
        isActive: true,
        deletedAt: null,
        variants: {
          some: { isActive: true, stock: { gte: 1 } },
        },
      },
      include: {
        variants: { where: { isActive: true }, take: 1 },
      },
    })

    const variant = product!.variants[0]

    // Add item to guest cart
    const addResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/cart/items',
      payload: { variantId: variant.id, quantity: 1 },
    })

    const setCookie = ([] as string[]).concat(addResponse.headers['set-cookie'] as any || [])
    const sessionCookie = setCookie?.find((c) => c.includes('ps_sid'))?.split(';')[0]

    const cartResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/cart',
      headers: { cookie: sessionCookie! },
    })

    const cartData = JSON.parse(cartResponse.body)

    // Try to order without email (guest, no auth)
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: { cookie: sessionCookie! },
      payload: {
        deliveryMethod: 'pickup',
        recipient: { name: 'Guest', phone: '+79999999999' },
        expectedTotal: cartData.subtotal,
      },
    })

    expect(orderResponse.statusCode).toBe(400)
    const orderData = JSON.parse(orderResponse.body)
    expect(orderData.error.code).toBe('EMAIL_REQUIRED')
  })
})
