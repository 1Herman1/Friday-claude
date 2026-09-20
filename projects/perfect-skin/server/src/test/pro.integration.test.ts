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
import productsRoutes from '../routes/products/index.js'
import cartRoutes from '../routes/cart/index.js'
import promoRoutes from '../routes/promo/index.js'
import deliveryRoutes from '../routes/delivery/index.js'
import ordersRoutes from '../routes/orders/index.js'
import proRoutes from '../routes/pro/index.js'
import adminRoutes from '../routes/admin/index.js'
import { db } from '../lib/db.js'

let app: FastifyInstance

const SUFFIX = '@pro-test.local'
const RETAIL_PRICE = 100000
const WHOLESALE_PRICE = 55000

async function build() {
  const app = Fastify()

  registerCommonSchemas(app)

  await app.register(prismaPlugin)
  await app.register(cookie, {
    secret: process.env.PS_COOKIE_SECRET || 'test-secret',
    hook: 'preHandler',
  })
  await app.register(cors, { origin: 'http://localhost:3000', credentials: true })
  await app.register(rateLimit, { max: 10000, timeWindow: '1 minute' })
  await app.register(authenticatePlugin)

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.status).send(errorResponse(error))
    }
    app.log.error({ error, requestId: request.id })
    console.error('ТЕСТ-500:', error)
    reply
      .status(500)
      .send(errorResponse(new ApiError(500, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера')))
  })

  await app.register(productsRoutes, { prefix: '/api/v1/products' })
  await app.register(cartRoutes)
  await app.register(promoRoutes)
  await app.register(deliveryRoutes)
  await app.register(ordersRoutes)
  await app.register(proRoutes)
  await app.register(adminRoutes)

  return app
}

function tokenFor(user: { id: string; role: string; tokenVersion: number }) {
  return sign(
    { userId: user.id, role: user.role, tv: user.tokenVersion },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '7d' }
  )
}

async function createUser(label: string, data: Record<string, unknown> = {}) {
  return db.user.create({
    data: {
      email: `pro-${Date.now()}-${Math.random().toString(36).slice(2)}-${label}${SUFFIX}`,
      name: `Pro Test ${label}`,
      role: 'customer',
      ...data,
    } as any,
  })
}

async function addToCart(token: string, variantId: string, quantity = 1) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/cart/items',
    payload: { variantId, quantity },
    headers: { authorization: `Bearer ${token}` },
  })
}

async function cleanup() {
  const products = await db.product.findMany({
    where: { slug: { startsWith: 'pro-test-' } },
    select: { id: true },
  })
  const productIds = products.map((p) => p.id)
  const users = await db.user.findMany({
    where: { email: { endsWith: SUFFIX } },
    select: { id: true },
  })
  const userIds = users.map((u) => u.id)

  if (userIds.length) {
    await db.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } })
    await db.promoCodeRedemption.deleteMany({ where: { userId: { in: userIds } } })
    await db.order.deleteMany({ where: { userId: { in: userIds } } })
    await db.cartItem.deleteMany({ where: { cart: { userId: { in: userIds } } } })
    await db.cart.deleteMany({ where: { userId: { in: userIds } } })
    await db.otpCode.deleteMany({ where: { userId: { in: userIds } } })
    await db.user.deleteMany({ where: { id: { in: userIds } } })
  }

  if (productIds.length) {
    const variants = await db.productVariant.findMany({
      where: { productId: { in: productIds } },
      select: { id: true },
    })
    const variantIds = variants.map((v) => v.id)
    if (variantIds.length) {
      await db.orderItem.deleteMany({ where: { productVariantId: { in: variantIds } } })
      await db.cartItem.deleteMany({ where: { productVariantId: { in: variantIds } } })
      await db.productVariant.deleteMany({ where: { id: { in: variantIds } } })
    }
    await db.product.deleteMany({ where: { id: { in: productIds } } })
  }

  await db.promoCode.deleteMany({ where: { code: { startsWith: 'PROTEST' } } })
}

let product: { id: string; slug: string }
let variant: { id: string }
let proProduct: { id: string; slug: string }
let proVariant: { id: string }

describe('Professional (wholesale) Integration Tests', () => {
  beforeAll(async () => {
    app = await build()
    await cleanup()

    const stamp = Date.now()

    product = await db.product.create({
      data: {
        name: 'Pro Test Regular Product',
        slug: `pro-test-regular-${stamp}`,
        isActive: true,
        description: 'Regular product for professional pricing tests',
        skinTypes: [],
        concerns: [],
      },
    })
    variant = await db.productVariant.create({
      data: {
        productId: product.id,
        volumeValue: 50,
        volumeUnit: 'ml',
        retailPrice: RETAIL_PRICE,
        wholesalePrice: WHOLESALE_PRICE,
        stock: 10,
        isActive: true,
      },
    })

    proProduct = await db.product.create({
      data: {
        name: 'Pro Test Professional Product',
        slug: `pro-test-professional-${stamp}`,
        isActive: true,
        isProfessional: true,
        description: 'Cabinet-only product',
        skinTypes: [],
        concerns: [],
      },
    })
    proVariant = await db.productVariant.create({
      data: {
        productId: proProduct.id,
        volumeValue: 500,
        volumeUnit: 'ml',
        retailPrice: RETAIL_PRICE,
        wholesalePrice: WHOLESALE_PRICE,
        stock: 10,
        isActive: true,
      },
    })
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  // 1. Guest sees retail price; professional product is price-hidden
  it('(1) Гость видит розничную цену, профи-товар — со скрытой ценой', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/products/${product.slug}` })
    expect(res.statusCode).toBe(200)
    const card = JSON.parse(res.body)
    expect(card.priceHidden).toBe(false)
    expect(card.minPrice).toBe(RETAIL_PRICE)
    expect(card.variants[0].retailPrice).toBe(RETAIL_PRICE)

    const proRes = await app.inject({ method: 'GET', url: `/api/v1/products/${proProduct.slug}` })
    expect(proRes.statusCode).toBe(200)
    const proCard = JSON.parse(proRes.body)
    expect(proCard.priceHidden).toBe(true)
    expect(proCard.minPrice).toBeNull()
    expect(proCard.variants[0].retailPrice).toBeNull()
  })

  // 2. Retail customer: retail price; professional product in cart → 403 PRO_ONLY
  it('(2) Розничный покупатель видит розницу, профи-товар в корзину → 403 PRO_ONLY', async () => {
    const user = await createUser('retail-2')
    const token = tokenFor(user)

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${product.slug}`,
      headers: { authorization: `Bearer ${token}` },
    })
    const card = JSON.parse(res.body)
    expect(card.priceHidden).toBe(false)
    expect(card.variants[0].retailPrice).toBe(RETAIL_PRICE)

    const proRes = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${proProduct.slug}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(JSON.parse(proRes.body).priceHidden).toBe(true)

    const addRes = await addToCart(token, proVariant.id)
    expect(addRes.statusCode).toBe(403)
    expect(JSON.parse(addRes.body).error.code).toBe('PRO_ONLY')
  })

  // 3. professional+pending → retail; professional+approved → wholesale
  it('(3) professional/pending получает розницу, professional/approved — опт', async () => {
    const pending = await createUser('pending-3', { role: 'professional', proStatus: 'pending' })
    const pendingToken = tokenFor(pending)

    const pendingRes = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${product.slug}`,
      headers: { authorization: `Bearer ${pendingToken}` },
    })
    const pendingCard = JSON.parse(pendingRes.body)
    expect(pendingCard.variants[0].retailPrice).toBe(RETAIL_PRICE)
    expect(pendingCard.minPrice).toBe(RETAIL_PRICE)

    const pendingProRes = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${proProduct.slug}`,
      headers: { authorization: `Bearer ${pendingToken}` },
    })
    expect(JSON.parse(pendingProRes.body).priceHidden).toBe(true)

    const approved = await createUser('approved-3', {
      role: 'professional',
      proStatus: 'approved',
    })
    const approvedToken = tokenFor(approved)

    const approvedRes = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${product.slug}`,
      headers: { authorization: `Bearer ${approvedToken}` },
    })
    const approvedCard = JSON.parse(approvedRes.body)
    expect(approvedCard.variants[0].retailPrice).toBe(WHOLESALE_PRICE)
    expect(approvedCard.variants[0].oldRetailPrice).toBe(RETAIL_PRICE)
    expect(approvedCard.minPrice).toBe(WHOLESALE_PRICE)

    const approvedProRes = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${proProduct.slug}`,
      headers: { authorization: `Bearer ${approvedToken}` },
    })
    const approvedProCard = JSON.parse(approvedProRes.body)
    expect(approvedProCard.priceHidden).toBe(false)
    expect(approvedProCard.variants[0].retailPrice).toBe(WHOLESALE_PRICE)
  })

  // 4. Approved professional cart subtotal uses wholesale price
  it('(4) Корзина одобренного профи считает subtotal по опту', async () => {
    const user = await createUser('cart-4', { role: 'professional', proStatus: 'approved' })
    const token = tokenFor(user)

    const addRes = await addToCart(token, variant.id, 2)
    expect(addRes.statusCode).toBe(201)

    const cartRes = await app.inject({
      method: 'GET',
      url: '/api/v1/cart',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(cartRes.statusCode).toBe(200)
    const cart = JSON.parse(cartRes.body)
    expect(cart.subtotal).toBe(WHOLESALE_PRICE * 2)
  })

  // 5. Approved professional order is stored at wholesale price
  it('(5) Заказ одобренного профи создаётся по оптовой цене', async () => {
    const user = await createUser('order-5', { role: 'professional', proStatus: 'approved' })
    const token = tokenFor(user)

    await addToCart(token, variant.id, 1)

    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      payload: {
        deliveryMethod: 'pickup',
        recipient: { name: 'Pro User', phone: '+79991110011' },
        expectedTotal: WHOLESALE_PRICE,
      },
      headers: { authorization: `Bearer ${token}` },
    })

    expect(orderRes.statusCode).toBe(201)
    const order = JSON.parse(orderRes.body)
    expect(order.total).toBe(WHOLESALE_PRICE)

    const items = await db.orderItem.findMany({ where: { orderId: order.id } })
    expect(items).toHaveLength(1)
    expect(items[0].price).toBe(WHOLESALE_PRICE)
  })

  // 6. Retail customer cannot buy at wholesale total
  it('(6) Розничный покупатель с оптовым expectedTotal получает отказ TOTAL_MISMATCH', async () => {
    const user = await createUser('spoof-6')
    const token = tokenFor(user)

    await addToCart(token, variant.id, 1)

    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      payload: {
        deliveryMethod: 'pickup',
        recipient: { name: 'Retail User', phone: '+79991110022' },
        expectedTotal: WHOLESALE_PRICE,
      },
      headers: { authorization: `Bearer ${token}` },
    })

    expect(orderRes.statusCode).toBe(409)
    const body = JSON.parse(orderRes.body)
    expect(body.error.code).toBe('TOTAL_MISMATCH')
    expect(body.error.details.total).toBe(RETAIL_PRICE)

    const orders = await db.order.count({ where: { userId: user.id } })
    expect(orders).toBe(0)
  })

  // 7. Promo codes are rejected for wholesale buyers
  it('(7) Промокод оптовому покупателю → PROMO_NOT_FOR_WHOLESALE', async () => {
    const user = await createUser('promo-7', { role: 'professional', proStatus: 'approved' })
    const token = tokenFor(user)

    const code = `PROTEST${Date.now()}`
    await db.promoCode.create({ data: { code, percent: 10, isActive: true } })

    await addToCart(token, variant.id, 1)

    const validateRes = await app.inject({
      method: 'POST',
      url: '/api/v1/promo/validate',
      payload: { code },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(validateRes.statusCode).toBe(409)
    expect(JSON.parse(validateRes.body).error.code).toBe('PROMO_NOT_FOR_WHOLESALE')

    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      payload: {
        deliveryMethod: 'pickup',
        recipient: { name: 'Pro User', phone: '+79991110033' },
        promoCode: code,
        expectedTotal: WHOLESALE_PRICE,
      },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(orderRes.statusCode).toBe(409)
    expect(JSON.parse(orderRes.body).error.code).toBe('PROMO_NOT_FOR_WHOLESALE')
  })

  // 8. Full application flow: apply → admin approves → wholesale catalog
  it('(8) Заявка на статус: подача, повтор, валидация, админ одобряет → опт', async () => {
    const user = await createUser('apply-8')
    const token = tokenFor(user)

    const noAuthRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pro/apply',
      payload: { companyName: 'ООО Тест', inn: '1234567890', specialization: 'косметолог' },
    })
    expect(noAuthRes.statusCode).toBe(401)

    const badInnRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pro/apply',
      payload: { companyName: 'ООО Тест', inn: '123', specialization: 'косметолог' },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(badInnRes.statusCode).toBe(400)

    const applyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pro/apply',
      payload: {
        companyName: 'ООО Тест',
        inn: '1234567890',
        specialization: 'косметолог',
        comment: 'Работаю в салоне',
      },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(applyRes.statusCode).toBe(200)
    expect(JSON.parse(applyRes.body).proStatus).toBe('pending')

    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/pro/status',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(statusRes.statusCode).toBe(200)
    expect(JSON.parse(statusRes.body).proStatus).toBe('pending')

    const repeatRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pro/apply',
      payload: { companyName: 'ООО Тест', inn: '1234567890', specialization: 'косметолог' },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(repeatRes.statusCode).toBe(409)
    expect(JSON.parse(repeatRes.body).error.code).toBe('PRO_ALREADY_REQUESTED')

    // Обычный покупатель на админский роут
    const forbiddenRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/pro-requests?status=pending',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(forbiddenRes.statusCode).toBe(403)

    const admin = await createUser('admin-8', { role: 'super_admin' })
    const adminToken = tokenFor(admin)

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/pro-requests?status=pending&limit=100',
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(listRes.statusCode).toBe(200)
    const list = JSON.parse(listRes.body)
    expect(list.items.some((u: any) => u.id === user.id)).toBe(true)

    const approveRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/pro-requests/${user.id}`,
      payload: { action: 'approve' },
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(approveRes.statusCode).toBe(200)
    expect(JSON.parse(approveRes.body).proStatus).toBe('approved')

    const dbUser = await db.user.findUnique({ where: { id: user.id } })
    expect(dbUser!.role).toBe('professional')
    expect(dbUser!.proStatus).toBe('approved')

    const cardRes = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${product.slug}`,
      headers: { authorization: `Bearer ${token}` },
    })
    const card = JSON.parse(cardRes.body)
    expect(card.variants[0].retailPrice).toBe(WHOLESALE_PRICE)
    expect(card.variants[0].oldRetailPrice).toBe(RETAIL_PRICE)
  })

  // 9.1. Professional variants: guest sees retail variant, pro variant with priceHidden=true
  it('(9.1) Гость видит розничный вариант с ценой и профи-вариант со скрытой ценой', async () => {
    const stamp = Date.now()
    const testProduct = await db.product.create({
      data: {
        name: `Pro Test Variant Product ${stamp}`,
        slug: `pro-test-variant-${stamp}`,
        isActive: true,
        description: 'Product with pro and retail variants',
        skinTypes: [],
        concerns: [],
      },
    })

    // Розничный вариант
    const retailVar = await db.productVariant.create({
      data: {
        productId: testProduct.id,
        volumeValue: 200,
        volumeUnit: 'ml',
        retailPrice: 100000,
        oldRetailPrice: 55000,
        stock: 10,
        isActive: true,
        isProfessional: false,
      },
    })

    // Профессиональный вариант той же фасовки
    const proVar = await db.productVariant.create({
      data: {
        productId: testProduct.id,
        volumeValue: 1000,
        volumeUnit: 'ml',
        retailPrice: 190000,
        oldRetailPrice: 100000,
        stock: 10,
        isActive: true,
        isProfessional: true,
      },
    })

    const res = await app.inject({ method: 'GET', url: `/api/v1/products/${testProduct.slug}` })
    expect(res.statusCode).toBe(200)
    const card = JSON.parse(res.body)

    // Минимальная цена только по розничным вариантам
    expect(card.minPrice).toBe(100000)
    expect(card.priceHidden).toBe(false)

    // Розничный вариант видимый
    const retail = card.variants.find((v: any) => v.id === retailVar.id)
    expect(retail).toBeDefined()
    expect(retail.retailPrice).toBe(100000)
    expect(retail.isProfessional).toBe(false)
    expect(retail.priceHidden).toBe(false)

    // Профи-вариант скрытый
    const pro = card.variants.find((v: any) => v.id === proVar.id)
    expect(pro).toBeDefined()
    expect(pro.retailPrice).toBeNull()
    expect(pro.isProfessional).toBe(true)
    expect(pro.priceHidden).toBe(true)
  })

  // 9.2. Retail customer adds pro variant to cart → 403 PRO_ONLY
  it('(9.2) Розничный покупатель добавляет профи-вариант в корзину → 403 PRO_ONLY', async () => {
    const stamp = Date.now()
    const testProduct = await db.product.create({
      data: {
        name: `Pro Test Add Cart ${stamp}`,
        slug: `pro-test-add-cart-${stamp}`,
        isActive: true,
        description: 'Product for cart test',
        skinTypes: [],
        concerns: [],
      },
    })

    const proVar = await db.productVariant.create({
      data: {
        productId: testProduct.id,
        volumeValue: 200,
        volumeUnit: 'ml',
        retailPrice: 100000,
        stock: 10,
        isActive: true,
        isProfessional: true,
      },
    })

    const user = await createUser('cart-pro-9.2')
    const token = tokenFor(user)

    const addRes = await addToCart(token, proVar.id)
    expect(addRes.statusCode).toBe(403)
    expect(JSON.parse(addRes.body).error.code).toBe('PRO_ONLY')
  })

  // 9.3. Approved professional sees pro variant with wholesale price
  it('(9.3) Одобренный профи видит профи-вариант с оптовой ценой', async () => {
    const stamp = Date.now()
    const testProduct = await db.product.create({
      data: {
        name: `Pro Test Approved Variant ${stamp}`,
        slug: `pro-test-approved-variant-${stamp}`,
        isActive: true,
        description: 'Product for approved professional',
        skinTypes: [],
        concerns: [],
      },
    })

    const proVar = await db.productVariant.create({
      data: {
        productId: testProduct.id,
        volumeValue: 1000,
        volumeUnit: 'ml',
        retailPrice: 190000,
        wholesalePrice: 100000,
        stock: 10,
        isActive: true,
        isProfessional: true,
      },
    })

    const approved = await createUser('approved-9.3', {
      role: 'professional',
      proStatus: 'approved',
    })
    const token = tokenFor(approved)

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${testProduct.slug}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const card = JSON.parse(res.body)

    const pro = card.variants.find((v: any) => v.id === proVar.id)
    expect(pro).toBeDefined()
    expect(pro.isProfessional).toBe(true)
    expect(pro.priceHidden).toBe(false)
    expect(pro.retailPrice).toBe(100000) // оптовая цена
    expect(pro.oldRetailPrice).toBe(190000) // розничная как старая цена
  })

  // 9. Reject requires a reason and stores it
  it('(9) Отклонение заявки: без причины → 400, с причиной → rejected', async () => {
    const user = await createUser('reject-9')
    const token = tokenFor(user)
    const admin = await createUser('admin-9', { role: 'super_admin' })
    const adminToken = tokenFor(admin)

    await app.inject({
      method: 'POST',
      url: '/api/v1/pro/apply',
      payload: { companyName: 'ООО Отказ', inn: '123456789012', specialization: 'массажист' },
      headers: { authorization: `Bearer ${token}` },
    })

    const noReasonRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/pro-requests/${user.id}`,
      payload: { action: 'reject' },
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(noReasonRes.statusCode).toBe(400)

    const rejectRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/pro-requests/${user.id}`,
      payload: { action: 'reject', reason: 'Нет подтверждающих документов' },
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(rejectRes.statusCode).toBe(200)
    expect(JSON.parse(rejectRes.body).proStatus).toBe('rejected')

    const dbUser = await db.user.findUnique({ where: { id: user.id } })
    expect(dbUser!.proStatus).toBe('rejected')
    expect(dbUser!.proRejectReason).toBe('Нет подтверждающих документов')
  })
})
