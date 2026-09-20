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
import ordersRoutes from '../routes/orders/index.js'
import publicPostsRoutes from '../routes/posts/index.js'
import adminRoutes from '../routes/admin/index.js'
import productsRoutes from '../routes/products/index.js'
import { db } from '../lib/db.js'

// Отдельный домен от checkout-теста (@ps-test.local): тот в beforeAll сносит
// всех своих пользователей, а файлы vitest идут параллельно.
const DOMAIN = '@ps-admintest.local'
const POST_SLUG_PREFIX = 'admin-test-post-'
const PARTNER_NAME = `AdminTest Partner ${Date.now()}`
const PROMO_CODE = `ADMT${Date.now().toString().slice(-8)}`

let app: FastifyInstance
const tokens: Record<string, string> = {}
let priceVariantId = ''
let priceVariantOriginal = 0

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

  await app.register(cartRoutes)
  await app.register(ordersRoutes)
  await app.register(publicPostsRoutes, { prefix: '/api/v1' })
  await app.register(productsRoutes, { prefix: '/api/v1' })
  await app.register(adminRoutes)

  return app
}

async function makeStaff(role: string) {
  const email = `staff-${role}-${Date.now()}-${Math.random().toString(36).slice(2)}${DOMAIN}`
  const user = await db.user.create({ data: { email, name: `Staff ${role}`, role: role as any } })
  return sign(
    { userId: user.id, role: user.role, tv: user.tokenVersion },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '1d' }
  )
}

async function pickVariantInStock() {
  const product = await db.product.findFirst({
    where: {
      isActive: true,
      deletedAt: null,
      variants: { some: { isActive: true, deletedAt: null, stock: { gte: 1 }, retailPrice: { gt: 0 } } },
    },
    include: { variants: { where: { isActive: true, deletedAt: null, stock: { gte: 1 } }, take: 1 } },
  })
  expect(product).toBeTruthy()
  return product!.variants[0]
}

/** Гостевой заказ по образцу checkout-теста. promoCode — опционально. */
async function createGuestOrder(promoCode?: string) {
  const variant = await pickVariantInStock()
  const email = `guest-${Date.now()}-${Math.random().toString(36).slice(2)}${DOMAIN}`

  const add = await app.inject({
    method: 'POST',
    url: '/api/v1/cart/items',
    payload: { variantId: variant.id, quantity: 1 },
  })
  expect(add.statusCode).toBe(201)
  const setCookie = ([] as string[]).concat((add.headers['set-cookie'] as any) || [])
  const sessionCookie = setCookie.find((c) => c.includes('ps_sid'))!.split(';')[0]

  const cart = JSON.parse(
    (await app.inject({ method: 'GET', url: '/api/v1/cart', headers: { cookie: sessionCookie } })).body
  )

  const payload: any = {
    deliveryMethod: 'pickup',
    recipient: { name: 'Admin Test Guest', phone: '+79990000000', email },
    expectedTotal: cart.subtotal,
  }
  if (promoCode) payload.promoCode = promoCode

  let res = await app.inject({
    method: 'POST',
    url: '/api/v1/orders',
    headers: { cookie: sessionCookie },
    payload,
  })

  // С промокодом итог меньше subtotal — сервер сам возвращает корректную сумму.
  if (res.statusCode === 409 && JSON.parse(res.body).error.code === 'TOTAL_MISMATCH') {
    payload.expectedTotal = JSON.parse(res.body).error.details.total
    res = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: { cookie: sessionCookie },
      payload,
    })
  }

  expect(res.statusCode).toBe(201)
  return JSON.parse(res.body) as { id: string; number: string; total: number }
}

describe('Admin Integration Tests', () => {
  beforeAll(async () => {
    app = await build()

    tokens.customer = await makeStaff('customer')
    tokens.orders = await makeStaff('orders_manager')
    tokens.products = await makeStaff('products_manager')
    tokens.super = await makeStaff('super_admin')

    await db.productVariant.updateMany({ data: { stock: 10 } })
  })

  afterAll(async () => {
    // Цена варианта — обратно, иначе каталог уедет между прогонами.
    if (priceVariantId) {
      await db.productVariant.update({
        where: { id: priceVariantId },
        data: { retailPrice: priceVariantOriginal },
      })
      await db.$executeRaw`
        UPDATE products p SET
          "minPrice" = COALESCE(v.min_price, 0),
          "maxPrice" = COALESCE(v.max_price, 0)
        FROM (
          SELECT MIN("retailPrice") AS min_price, MAX("retailPrice") AS max_price
          FROM product_variants
          WHERE "productId" = (SELECT "productId" FROM product_variants WHERE id = ${priceVariantId})
            AND "isActive" AND "deletedAt" IS NULL
        ) v
        WHERE p.id = (SELECT "productId" FROM product_variants WHERE id = ${priceVariantId})`
    }

    await db.post.deleteMany({ where: { slug: { startsWith: POST_SLUG_PREFIX } } })

    const users = await db.user.findMany({
      where: { email: { endsWith: DOMAIN } },
      select: { id: true },
    })
    const ids = users.map((u) => u.id)
    if (ids.length) {
      await db.promoCodeRedemption.deleteMany({ where: { userId: { in: ids } } })
      await db.orderItem.deleteMany({ where: { order: { userId: { in: ids } } } })
      await db.order.deleteMany({ where: { userId: { in: ids } } })
      await db.cart.deleteMany({ where: { userId: { in: ids } } })
      await db.otpCode.deleteMany({ where: { userId: { in: ids } } })
      await db.user.deleteMany({ where: { id: { in: ids } } })
    }

    await db.promoCode.deleteMany({ where: { code: PROMO_CODE } })
    await db.partner.deleteMany({ where: { name: PARTNER_NAME } })

    await app.close()
  })

  // ─────────────────────────── 1. Доступ ───────────────────────────

  it('гость без токена не попадает в админские заказы (401)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/orders' })
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body).error.code).toBe('UNAUTHORIZED')
  })

  it('покупатель не попадает в админские заказы (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/orders',
      headers: { authorization: `Bearer ${tokens.customer}` },
    })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body).error.code).toBe('FORBIDDEN')
  })

  it('orders_manager видит заказы, но не товары', async () => {
    const orders = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/orders',
      headers: { authorization: `Bearer ${tokens.orders}` },
    })
    expect(orders.statusCode).toBe(200)

    const variants = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/variants',
      headers: { authorization: `Bearer ${tokens.orders}` },
    })
    expect(variants.statusCode).toBe(403)
  })

  it('products_manager видит товары, но не заказы', async () => {
    const variants = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/variants',
      headers: { authorization: `Bearer ${tokens.products}` },
    })
    expect(variants.statusCode).toBe(200)

    const orders = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/orders',
      headers: { authorization: `Bearer ${tokens.products}` },
    })
    expect(orders.statusCode).toBe(403)
  })

  // ─────────────────────── 2. Машина статусов ───────────────────────

  it('машина статусов: вперёд можно, назад и из терминального — 409', async () => {
    const order = await createGuestOrder()
    const auth = { authorization: `Bearer ${tokens.orders}` }
    const patch = (status: string) =>
      app.inject({ method: 'PATCH', url: `/api/v1/admin/orders/${order.id}`, headers: auth, payload: { status } })

    const toConfirmed = await patch('confirmed')
    expect(toConfirmed.statusCode).toBe(200)
    expect(JSON.parse(toConfirmed.body).status).toBe('confirmed')

    const back = await patch('new')
    expect(back.statusCode).toBe(409)
    expect(JSON.parse(back.body).error.code).toBe('INVALID_STATUS_TRANSITION')

    // Через шаг вперёд — разрешено
    const toDelivered = await patch('delivered')
    expect(toDelivered.statusCode).toBe(200)
    expect(JSON.parse(toDelivered.body).status).toBe('delivered')

    const fromTerminal = await patch('cancelled')
    expect(fromTerminal.statusCode).toBe(409)
    expect(JSON.parse(fromTerminal.body).error.code).toBe('INVALID_STATUS_TRANSITION')

    const inDb = await db.order.findUnique({ where: { id: order.id } })
    expect(inDb!.status).toBe('delivered')
  })

  // ──────────────────────────── 3. Товары ────────────────────────────

  it('смена цены фасовки пересчитывает minPrice/maxPrice товара', async () => {
    const variant = await pickVariantInStock()
    priceVariantId = variant.id
    priceVariantOriginal = variant.retailPrice

    const newPrice = variant.retailPrice + 12345

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/variants/${variant.id}`,
      headers: { authorization: `Bearer ${tokens.products}` },
      payload: { retailPrice: newPrice },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).retailPrice).toBe(newPrice)

    const siblings = await db.productVariant.findMany({
      where: { productId: variant.productId, isActive: true, deletedAt: null, isProfessional: false },
      select: { retailPrice: true },
    })
    const expectedMin = siblings.length > 0 ? Math.min(...siblings.map((v) => v.retailPrice)) : 0
    const expectedMax = siblings.length > 0 ? Math.max(...siblings.map((v) => v.retailPrice)) : 0

    const product = await db.product.findUnique({ where: { id: variant.productId } })
    expect(product!.minPrice).toBe(expectedMin)
    expect(product!.maxPrice).toBe(expectedMax)
    expect(expectedMax).toBeGreaterThanOrEqual(newPrice)
  })

  // ─────────────────────── 4. Отчёт партнёров ───────────────────────

  it('отчёт партнёров считает выплату только по оплаченному заказу', async () => {
    const auth = { authorization: `Bearer ${tokens.super}` }

    const partnerRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/partners',
      headers: auth,
      payload: { name: PARTNER_NAME, commissionPercent: 10 },
    })
    expect(partnerRes.statusCode).toBe(201)
    const partner = JSON.parse(partnerRes.body)

    const codeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/promo-codes',
      headers: auth,
      payload: { code: PROMO_CODE, percent: 15, partnerId: partner.id },
    })
    expect(codeRes.statusCode).toBe(201)

    const paidOrder = await createGuestOrder(PROMO_CODE)
    const cancelledOrder = await createGuestOrder(PROMO_CODE)
    await createGuestOrder(PROMO_CODE) // остаётся new — не оплачен, не отменён

    const markPaid = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/orders/${paidOrder.id}`,
      headers: auth,
      payload: { markPaid: true },
    })
    expect(markPaid.statusCode).toBe(200)
    expect(JSON.parse(markPaid.body).paymentStatus).toBe('paid')

    const cancel = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/orders/${cancelledOrder.id}`,
      headers: auth,
      payload: { status: 'cancelled' },
    })
    expect(cancel.statusCode).toBe(200)

    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date(Date.now() + 60_000)

    const reportRes = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/partners/report?from=${from.toISOString()}&to=${to.toISOString()}`,
      headers: auth,
    })
    expect(reportRes.statusCode).toBe(200)

    const row = JSON.parse(reportRes.body).rows.find((r: any) => r.partnerId === partner.id)
    expect(row).toBeTruthy()
    expect(row.commissionPercent).toBe(10)
    // Деньги: выплата только с оплаченного заказа, отменённый в выручку не входит.
    expect(row.revenue).toBe(paidOrder.total)
    expect(row.payout).toBe(Math.round((paidOrder.total * 10) / 100))
    expect(row.paidOrdersCount).toBe(1)
    // По коду пришло 3 заказа: оплаченный и неоплаченный считаются,
    // отменённый — нет. Итого ordersCount = 2 при paidOrdersCount = 1.
    expect(row.ordersCount).toBe(2)
  })

  // ───────────────────────── 5. Утечка полей ─────────────────────────

  it('карточка заказа отдаёт adminNote и не отдаёт tokenVersion/passwordHash', async () => {
    const order = await createGuestOrder()
    const auth = { authorization: `Bearer ${tokens.super}` }

    const note = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/orders/${order.id}`,
      headers: auth,
      payload: { adminNote: 'Проверка утечки полей' },
    })
    expect(note.statusCode).toBe(200)

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/orders/${order.id}`,
      headers: auth,
    })
    expect(res.statusCode).toBe(200)

    const body = JSON.parse(res.body)
    expect(body.adminNote).toBe('Проверка утечки полей')
    expect(JSON.stringify(body)).not.toContain('tokenVersion')
    expect(JSON.stringify(body)).not.toContain('passwordHash')
  })

  // ──────────────────────────── 6. Статьи ────────────────────────────

  it('опубликованная статья отдаётся публично с товарами, черновик — 404', async () => {
    const product = await db.product.findFirst({
      where: { isActive: true, deletedAt: null },
      select: { slug: true },
    })
    expect(product).toBeTruthy()

    const auth = { authorization: `Bearer ${tokens.super}` }
    const publishedSlug = `${POST_SLUG_PREFIX}pub-${Date.now()}`
    const draftSlug = `${POST_SLUG_PREFIX}draft-${Date.now()}`

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/posts',
      headers: auth,
      payload: {
        title: 'Тестовая статья админки',
        slug: publishedSlug,
        body: `Текст статьи. [[product:${product!.slug}]] Конец.`,
        publishedAt: new Date().toISOString(),
      },
    })
    expect(created.statusCode).toBe(201)

    const draft = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/posts',
      headers: auth,
      payload: {
        title: 'Черновик админки',
        slug: draftSlug,
        body: 'Ещё не опубликовано.',
      },
    })
    expect(draft.statusCode).toBe(201)
    expect(await db.post.findFirst({ where: { slug: draftSlug } })).toMatchObject({
      publishedAt: null,
    })

    const publicRes = await app.inject({ method: 'GET', url: `/api/v1/posts/${publishedSlug}` })
    expect(publicRes.statusCode).toBe(200)
    const publicBody = JSON.parse(publicRes.body)
    expect(publicBody.slug).toBe(publishedSlug)
    expect(publicBody.products).toHaveLength(1)
    expect(publicBody.products[0].slug).toBe(product!.slug)

    const draftRes = await app.inject({ method: 'GET', url: `/api/v1/posts/${draftSlug}` })
    expect(draftRes.statusCode).toBe(404)
    // Именно «не найдена», а не промах роутинга — иначе тест зелёный по ошибке.
    expect(JSON.parse(draftRes.body).error.code).toBe('NOT_FOUND')
  })

  // ──────────────────────────── 7. Популярные товары ────────────────────────────

  it('PUT /admin/popular устанавливает порядок; GET показывает закреплённые первыми', async () => {
    const auth = { authorization: `Bearer ${tokens.super}` }

    // Получить 2 случайных товара
    const products = await db.product.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, slug: true },
      take: 2,
    })
    expect(products.length).toBe(2)
    const [p1, p2] = products

    // Установить их в популярные
    const setRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/popular',
      headers: auth,
      payload: { productIds: [p1.id, p2.id] },
    })
    expect(setRes.statusCode).toBe(200)

    // GET /admin/popular должен вернуть их в том же порядке
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/popular',
      headers: auth,
    })
    expect(getRes.statusCode).toBe(200)
    const popular = JSON.parse(getRes.body)
    expect(popular.length).toBe(2)
    expect(popular[0].id).toBe(p1.id)
    expect(popular[1].id).toBe(p2.id)
    expect(popular[0].popularPin).toBe(1)
    expect(popular[1].popularPin).toBe(2)

    // Проверить в БД что пины установлены
    const dbP1 = await db.product.findUnique({ where: { id: p1.id }, select: { popularPin: true } })
    const dbP2 = await db.product.findUnique({ where: { id: p2.id }, select: { popularPin: true } })
    expect(dbP1?.popularPin).toBe(1)
    expect(dbP2?.popularPin).toBe(2)

    // Обновить список (только один товар)
    const updateRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/popular',
      headers: auth,
      payload: { productIds: [p2.id] },
    })
    expect(updateRes.statusCode).toBe(200)

    // Первый товар уже не закреплён
    const getRes2 = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/popular',
      headers: auth,
    })
    expect(getRes2.statusCode).toBe(200)
    const popular2 = JSON.parse(getRes2.body)
    expect(popular2.length).toBe(1)
    expect(popular2[0].id).toBe(p2.id)

    // Проверить в БД что пины обновлены
    const dbP1After = await db.product.findUnique({ where: { id: p1.id }, select: { popularPin: true } })
    const dbP2After = await db.product.findUnique({ where: { id: p2.id }, select: { popularPin: true } })
    expect(dbP1After?.popularPin).toBeNull()
    expect(dbP2After?.popularPin).toBe(1)

    // Снять все пины
    await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/popular',
      headers: auth,
      payload: { productIds: [] },
    })

    // Проверить что все пины удалены
    const dbP1Final = await db.product.findUnique({ where: { id: p1.id }, select: { popularPin: true } })
    const dbP2Final = await db.product.findUnique({ where: { id: p2.id }, select: { popularPin: true } })
    expect(dbP1Final?.popularPin).toBeNull()
    expect(dbP2Final?.popularPin).toBeNull()
  })
})
