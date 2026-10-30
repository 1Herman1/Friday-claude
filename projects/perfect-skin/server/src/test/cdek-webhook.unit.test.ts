import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { ApiError, errorResponse } from '../lib/errors.js'
import { maskSensitiveUrl } from '../lib/log-mask.js'
import { registerCommonSchemas } from '../schemas/common.js'
import deliveryCdekRoutes from '../routes/delivery/cdek.js'
import { parseCdekConfig, type CdekConfig } from '../services/cdek/config.js'
import type { CdekClient } from '../services/cdek/client.js'
import type { CdekOrderSync } from '../services/cdek/order-sync.js'
import { setCdekForTests, setCdekSync } from '../services/cdek/registry.js'

const SECRET = 'w'.repeat(40)
const cfg = parseCdekConfig(
  { PS_CDEK_CLIENT_ID: 'id', PS_CDEK_CLIENT_SECRET: 'secret', PS_CDEK_WEBHOOK_SECRET: SECRET },
  'host'
) as CdekConfig

const body = { type: 'ORDER_STATUS', uuid: '11111111-1111-4111-8111-111111111111', attributes: { cdek_number: 1234, code: 'DELIVERED' } }

let app: FastifyInstance
const handleWebhook = vi.fn(async () => 'refreshed' as const)

beforeAll(async () => {
  app = Fastify({ logger: false })
  registerCommonSchemas(app)
  await app.register(rateLimit, { max: 1000, timeWindow: '1 minute' })
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send(errorResponse(error))
    return reply.status(500).send({ error: { code: 'INTERNAL_ERROR' } })
  })
  await app.register(deliveryCdekRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

afterEach(() => {
  setCdekForTests(null)
  setCdekSync(null)
  handleWebhook.mockClear()
})

function enable(): void {
  setCdekForTests({ config: cfg, client: {} as CdekClient })
  setCdekSync({ handleWebhook } as unknown as CdekOrderSync)
}

describe('CDEK webhook route', () => {
  it('интеграция выключена → 404', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/v1/delivery/cdek/webhook/${SECRET}`, payload: body })
    expect(res.statusCode).toBe(404)
    expect(handleWebhook).not.toHaveBeenCalled()
  })

  it('неверный секрет в URL → 404, синхронизация не вызвана', async () => {
    enable()
    const res = await app.inject({ method: 'POST', url: `/api/v1/delivery/cdek/webhook/${'x'.repeat(40)}`, payload: body })
    expect(res.statusCode).toBe(404)
    expect(handleWebhook).not.toHaveBeenCalled()
  })

  it('битое тело → 400', async () => {
    enable()
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/delivery/cdek/webhook/${SECRET}`,
      payload: { attributes: { code: 5 } },
    })
    expect(res.statusCode).toBe(400)
    expect(handleWebhook).not.toHaveBeenCalled()
  })

  it('верный секрет → 200 и вызов обновления с разобранным телом', async () => {
    enable()
    const res = await app.inject({ method: 'POST', url: `/api/v1/delivery/cdek/webhook/${SECRET}`, payload: body })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    expect(handleWebhook).toHaveBeenCalledTimes(1)
  })

  it('сбой обновления → всё равно 200, чтобы СДЭК не ретраил', async () => {
    enable()
    handleWebhook.mockRejectedValueOnce(new Error('db down'))
    const res = await app.inject({ method: 'POST', url: `/api/v1/delivery/cdek/webhook/${SECRET}`, payload: body })
    expect(res.statusCode).toBe(200)
  })
})

describe('maskSensitiveUrl', () => {
  it('скрывает секрет вебхука, сохраняя путь и query', () => {
    expect(maskSensitiveUrl(`/api/v1/delivery/cdek/webhook/${SECRET}?x=1`)).toBe(
      '/api/v1/delivery/cdek/webhook/[скрыто]?x=1'
    )
  })

  it('по-прежнему скрывает токен просмотра заявки', () => {
    expect(maskSensitiveUrl('/api/v1/review/abc123/extra')).toBe('/api/v1/review/[скрыто]/extra')
  })

  it('обычные пути не меняет', () => {
    expect(maskSensitiveUrl('/api/v1/orders/track')).toBe('/api/v1/orders/track')
  })
})
