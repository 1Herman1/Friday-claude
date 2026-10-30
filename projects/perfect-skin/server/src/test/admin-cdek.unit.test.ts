import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { cdekAwaitingPayment, cdekCanSubmit, adminOrderService } from '../services/admin-order.service.js'
import { setCdekForTests, setCdekSync, type CdekServices } from '../services/cdek/registry.js'
import type { CdekClient } from '../services/cdek/client.js'
import type { CdekOrderSync } from '../services/cdek/order-sync.js'
import { parseCdekConfig, type CdekConfig } from '../services/cdek/config.js'
import { ApiError, errorResponse } from '../lib/errors.js'
import { registerCommonSchemas } from '../schemas/common.js'
import { cdekAdminRoutes } from '../routes/admin/cdek.js'

const cfg = parseCdekConfig({ PS_CDEK_CLIENT_ID: 'id', PS_CDEK_CLIENT_SECRET: 'secret' }, 'host') as CdekConfig
const now = new Date('2026-10-30T12:00:00Z')
const base = { deliveryMethod: 'cdek_courier', status: 'new' as const, paymentStatus: 'paid' as const, cdekState: null, cdekRequestedAt: null }

afterEach(() => {
  setCdekForTests(null)
  setCdekSync(null)
})

describe('cdekCanSubmit', () => {
  it('выключено → нельзя передать', () => {
    expect(cdekCanSubmit(base, now)).toBe(false)
  })

  it('включено: новый курьерский оплаченный заказ можно передать', () => {
    setCdekForTests({ config: cfg, client: {} as CdekClient } as CdekServices)
    expect(cdekCanSubmit(base, now)).toBe(true)
  })

  it('самовывоз, отменённый и доставленный — нельзя', () => {
    setCdekForTests({ config: cfg, client: {} as CdekClient } as CdekServices)
    expect(cdekCanSubmit({ ...base, deliveryMethod: 'pickup' }, now)).toBe(false)
    expect(cdekCanSubmit({ ...base, status: 'cancelled' }, now)).toBe(false)
    expect(cdekCanSubmit({ ...base, status: 'delivered' }, now)).toBe(false)
  })

  it('accepted и created — нельзя; invalid — можно повторить', () => {
    setCdekForTests({ config: cfg, client: {} as CdekClient } as CdekServices)
    expect(cdekCanSubmit({ ...base, cdekState: 'accepted' }, now)).toBe(false)
    expect(cdekCanSubmit({ ...base, cdekState: 'created' }, now)).toBe(false)
    expect(cdekCanSubmit({ ...base, cdekState: 'invalid' }, now)).toBe(true)
  })

  it('creating: свежий захват — нельзя, старше 5 минут — можно', () => {
    setCdekForTests({ config: cfg, client: {} as CdekClient } as CdekServices)
    expect(cdekCanSubmit({ ...base, cdekState: 'creating', cdekRequestedAt: new Date(now.getTime() - 60_000) }, now)).toBe(false)
    expect(cdekCanSubmit({ ...base, cdekState: 'creating', cdekRequestedAt: new Date(now.getTime() - 6 * 60_000) }, now)).toBe(true)
  })

  it('неоплаченный заказ передать нельзя, но кнопка «ждёт оплату» показывается', () => {
    setCdekForTests({ config: cfg, client: {} as CdekClient } as CdekServices)
    const unpaid = { ...base, paymentStatus: 'pending' as const }
    expect(cdekCanSubmit(unpaid, now)).toBe(false)
    expect(cdekAwaitingPayment(unpaid, now)).toBe(true)
    expect(cdekAwaitingPayment(base, now)).toBe(false)
  })

  it('ждёт оплату только там, где передача вообще возможна', () => {
    setCdekForTests({ config: cfg, client: {} as CdekClient } as CdekServices)
    const unpaid = { ...base, paymentStatus: 'pending' as const }
    expect(cdekAwaitingPayment({ ...unpaid, deliveryMethod: 'pickup' }, now)).toBe(false)
    expect(cdekAwaitingPayment({ ...unpaid, cdekState: 'created' }, now)).toBe(false)
  })
})

describe('POST /orders/:id/cdek: передача без оплаты', () => {
  const orderId = '11111111-1111-4111-8111-111111111111'
  const submit = vi.fn(async (_id: string, _actor: string, _options?: { allowUnpaid?: boolean }) => {})
  let app: FastifyInstance
  let role = 'orders_manager'

  beforeAll(async () => {
    app = Fastify({ logger: false })
    registerCommonSchemas(app)
    app.decorateRequest('user', undefined)
    app.addHook('preHandler', async (request) => {
      request.user = { id: 'actor-1', role } as NonNullable<typeof request.user>
    })
    app.setErrorHandler((error, _request, reply) => {
      if (error instanceof ApiError) return reply.status(error.status).send(errorResponse(error))
      return reply.status(500).send({ error: { code: 'INTERNAL_ERROR' } })
    })
    await app.register(async (instance) => cdekAdminRoutes(instance, []), { prefix: '/api/v1/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  afterEach(() => {
    submit.mockClear()
    vi.restoreAllMocks()
  })

  it('orders_manager с force → 403 и передачи нет', async () => {
    role = 'orders_manager'
    setCdekSync({ submit } as unknown as CdekOrderSync)
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/orders/${orderId}/cdek`,
      payload: { force: true },
    })
    expect(res.statusCode).toBe(403)
    expect(submit).not.toHaveBeenCalled()
  })

  it('super_admin с force → передача с allowUnpaid', async () => {
    role = 'super_admin'
    setCdekSync({ submit } as unknown as CdekOrderSync)
    vi.spyOn(adminOrderService, 'getOrder').mockResolvedValue({} as never)
    await app.inject({ method: 'POST', url: `/api/v1/admin/orders/${orderId}/cdek`, payload: { force: true } })
    expect(submit).toHaveBeenCalledWith(orderId, 'manager', { allowUnpaid: true })
  })

  it('обычная передача без force не снимает проверку оплаты', async () => {
    role = 'orders_manager'
    setCdekSync({ submit } as unknown as CdekOrderSync)
    vi.spyOn(adminOrderService, 'getOrder').mockResolvedValue({} as never)
    await app.inject({ method: 'POST', url: `/api/v1/admin/orders/${orderId}/cdek`, payload: {} })
    expect(submit).toHaveBeenCalledWith(orderId, 'manager', { allowUnpaid: false })
  })
})
