import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { resetDb, closeTestPrisma } from './setup'

const RUN = Boolean(process.env.TEST_DATABASE_URL)

describe.skipIf(!RUN)('Заявка в службу доставки — только бэк-офис', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    const { buildApp } = await import('../index')
    app = await buildApp({ logger: false })
    await app.ready()
    await resetDb()
  })

  afterAll(async () => {
    await app.close()
    await closeTestPrisma()
  })

  const body = {
    provider: 'cdek' as const,
    orderId: 'someone-elses-order',
    address: { city: 'Москва', street: 'Тверская', house: '1' },
    weightKg: 1,
    recipientName: 'Кто-то',
    recipientPhone: '+79990000000',
  }

  it('без токена — 401, заявка не создаётся', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/delivery/create', payload: body })
    expect(res.statusCode).toBe(401)
  })

  it('покупатель не может отгрузить чужой заказ — 403', async () => {
    const token = app.jwt.sign({ userId: 'customer-1', role: 'customer' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/delivery/create',
      headers: { authorization: `Bearer ${token}` },
      payload: body,
    })
    expect(res.statusCode).toBe(403)
  })

  it('гостевой токен тоже не проходит — 403', async () => {
    const token = app.jwt.sign({ userId: 'guest-1', role: 'guest' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/delivery/create',
      headers: { authorization: `Bearer ${token}` },
      payload: body,
    })
    expect(res.statusCode).toBe(403)
  })

  it('менеджер заказов проходит проверку прав (дальше — дело службы, не 401/403)', async () => {
    const token = app.jwt.sign({ userId: 'manager-1', role: 'orders_manager' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/delivery/create',
      headers: { authorization: `Bearer ${token}` },
      payload: body,
    })
    expect([401, 403]).not.toContain(res.statusCode)
  })
})
