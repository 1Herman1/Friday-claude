import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
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
import { parseCdekConfig, type CdekConfig } from '../services/cdek/config.js'
import type { CdekClient, CdekPoint, CdekTariffQuote } from '../services/cdek/client.js'
import { setCdekForTests, type CdekServices } from '../services/cdek/registry.js'

const cfg = parseCdekConfig({ PS_CDEK_CLIENT_ID: 'id', PS_CDEK_CLIENT_SECRET: 'secret' }, 'host') as CdekConfig
const EMAIL_DOMAIN = '@cdek-checkout.ps-test.local'

const point: CdekPoint = {
  code: 'PVZ-TEST-1',
  type: 'PVZ',
  name: 'Тестовый пункт',
  address: 'Москва, Тверская, 1',
  city: 'Москва',
  cityCode: 44,
  workTime: '10:00-20:00',
  metro: null,
  lat: 55.76,
  lon: 37.6,
}

function fakeCdek(courierSumRub: number): CdekServices {
  const tariffs: CdekTariffQuote[] = [
    { tariffCode: 136, deliverySumRub: 310.4, periodMin: 2, periodMax: 4 },
    { tariffCode: 137, deliverySumRub: courierSumRub, periodMin: 1, periodMax: 2 },
  ]
  const client = {
    listPoints: async () => [point],
    tariffList: async () => tariffs,
  }
  return { config: cfg, client: client as unknown as CdekClient }
}

async function build(): Promise<FastifyInstance> {
  const app = Fastify()
  registerCommonSchemas(app)
  app.decorate('telegram', { onNewOrder: async () => undefined } as never)
  await app.register(prismaPlugin)
  await app.register(cookie, { secret: process.env.PS_COOKIE_SECRET || 'test-secret', hook: 'preHandler' })
  await app.register(rateLimit, { max: 10000, timeWindow: '1 minute' })
  await app.register(authenticatePlugin)
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send(errorResponse(error))
    throw error
  })
  await app.register(cartRoutes)
  await app.register(promoRoutes)
  await app.register(deliveryRoutes)
  await app.register(ordersRoutes)
  await app.register(authRoutes)
  return app
}

let app: FastifyInstance
let variantId: string
let variantPrice: number
let sid: string
let email: string

async function guestSession(): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/v1/cart/items', payload: { variantId, quantity: 1 } })
  const setCookie = [res.headers['set-cookie']].flat().find((line) => line?.startsWith('ps_sid=')) ?? ''
  return setCookie.split(';')[0].replace('ps_sid=', '')
}

async function methodsCost(code: 'cdek_pvz' | 'cdek_courier'): Promise<number> {
  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/delivery/methods?cityCode=44',
    headers: { cookie: `ps_sid=${sid}` },
  })
  const method = JSON.parse(res.body).methods.find((m: { code: string }) => m.code === code)
  return method.cost
}

function orderPayload(overrides: Record<string, unknown>) {
  return {
    recipient: { name: 'Тест Тестов', phone: '+79990000000', email },
    expectedTotal: variantPrice + 50_000,
    ...overrides,
  }
}

describe('Checkout with CDEK', () => {
  beforeAll(async () => {
    app = await build()
    const variant = await db.productVariant.findFirst({
      where: {
        isActive: true,
        deletedAt: null,
        retailPrice: { gt: 0, lt: 600_000 },
        product: { isActive: true, deletedAt: null, isProfessional: false },
      },
      select: { id: true, retailPrice: true },
    })
    if (!variant) throw new Error('В тестовой базе нет розничного варианта для чекаута')
    variantId = variant.id
    variantPrice = variant.retailPrice
    await db.productVariant.update({ where: { id: variantId }, data: { stock: 50 } })
    email = `courier-${Date.now()}${EMAIL_DOMAIN}`
    setCdekForTests(fakeCdek(500))
    sid = await guestSession()
  })

  afterAll(async () => {
    setCdekForTests(null)
    await db.order.deleteMany({ where: { recipientEmail: { endsWith: EMAIL_DOMAIN } } })
    await db.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } })
    await app.close()
  })

  it('курьер без индекса и с apartment: null проходит, тариф СДЭК записан в заказ', async () => {
    const cost = await methodsCost('cdek_courier')
    expect(cost).toBe(50_000)

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: { cookie: `ps_sid=${sid}` },
      payload: orderPayload({
        deliveryMethod: 'cdek_courier',
        cdekCityCode: 44,
        address: { city: 'Москва', street: 'Тверская', house: '1', apartment: null },
      }),
    })
    expect(res.statusCode).toBe(201)

    const order = await db.order.findUniqueOrThrow({ where: { number: JSON.parse(res.body).number } })
    expect(order.cdekTariffCode).toBe(137)
    expect(order.cdekCityCode).toBe(44)
    expect(order.deliveryCost).toBe(50_000)
    expect(order.deliveryQuote).toMatchObject({ source: 'cdek', cdekSum: 50_000 })
  })

  it('ПВЗ пишет снимок пункта и тариф по типу точки', async () => {
    sid = await guestSession()
    email = `pvz-${Date.now()}${EMAIL_DOMAIN}`
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: { cookie: `ps_sid=${sid}` },
      payload: orderPayload({
        deliveryMethod: 'cdek_pvz',
        cdekPvzCode: point.code,
        cdekCityCode: 44,
        expectedTotal: variantPrice + 31_100,
      }),
    })
    expect(res.statusCode).toBe(201)

    const order = await db.order.findUniqueOrThrow({ where: { number: JSON.parse(res.body).number } })
    expect(order.cdekTariffCode).toBe(136)
    expect(order.deliveryPoint).toMatchObject({ code: point.code, type: 'PVZ', cityCode: 44 })
    expect(order.deliveryCost).toBe(31_100)
  })

  it('курьер без города при включённом СДЭК — CITY_REQUIRED', async () => {
    sid = await guestSession()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: { cookie: `ps_sid=${sid}` },
      payload: orderPayload({
        deliveryMethod: 'cdek_courier',
        address: { city: 'Москва', street: 'Тверская', house: '1' },
      }),
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.code).toBe('CITY_REQUIRED')
  })

  it('тариф сменился между показом и заказом — TOTAL_MISMATCH', async () => {
    sid = await guestSession()
    setCdekForTests(fakeCdek(500))
    const shownCost = await methodsCost('cdek_courier')
    setCdekForTests(fakeCdek(700))

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: { cookie: `ps_sid=${sid}` },
      payload: orderPayload({
        deliveryMethod: 'cdek_courier',
        cdekCityCode: 44,
        address: { city: 'Москва', street: 'Тверская', house: '1' },
        expectedTotal: variantPrice + shownCost,
      }),
    })
    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body).error.code).toBe('TOTAL_MISMATCH')
  })
})
