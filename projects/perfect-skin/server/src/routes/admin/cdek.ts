import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { adminOrderService } from '../../services/admin-order.service.js'
import { ApiError } from '../../lib/errors.js'
import { getCdekSync } from '../../services/cdek/registry.js'

const RATE_LIMIT = {
  max: 20,
  timeWindow: '1 minute',
  keyGenerator: (req: any) => req.user?.id ?? req.ip,
}

const printSchema = z.object({ kind: z.enum(['waybill', 'barcode']) })

const ERROR_RESPONSES = {
  401: { $ref: 'ps.error#' },
  403: { $ref: 'ps.error#' },
  404: { $ref: 'ps.error#' },
  409: { $ref: 'ps.error#' },
  422: { $ref: 'ps.error#' },
  503: { $ref: 'ps.error#' },
}

const ID_PARAMS = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
}

function requireSync() {
  const sync = getCdekSync()
  if (sync === null) throw new ApiError(409, 'CDEK_DISABLED', 'Интеграция с СДЭК выключена')
  return sync
}

export async function cdekAdminRoutes(app: FastifyInstance, preHandlers: any[]) {
  app.post<{ Params: { id: string }; Body: { force?: boolean } }>(
    '/orders/:id/cdek',
    {
      preHandler: preHandlers,
      config: { rateLimit: RATE_LIMIT },
      schema: {
        params: ID_PARAMS,
        body: {
          type: 'object',
          additionalProperties: false,
          properties: { force: { type: 'boolean' } },
        },
        response: { 200: { $ref: 'ps.adminOrder#' }, ...ERROR_RESPONSES },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { force?: boolean } }>, reply: FastifyReply) => {
      const force = request.body?.force === true
      if (force && request.user?.role !== 'super_admin') {
        throw new ApiError(403, 'FORBIDDEN', 'Передача без оплаты доступна только главному администратору')
      }
      await requireSync().submit(request.params.id, 'manager', { allowUnpaid: force })
      if (force) {
        request.log.warn({ orderId: request.params.id, actorId: request.user?.id }, 'СДЭК: заказ передан без оплаты')
      }
      reply.code(200)
      return adminOrderService.getOrder(request.params.id)
    }
  )

  app.post<{ Params: { id: string } }>(
    '/orders/:id/cdek/refresh',
    {
      preHandler: preHandlers,
      config: { rateLimit: RATE_LIMIT },
      schema: { params: ID_PARAMS, response: { 200: { $ref: 'ps.adminOrder#' }, ...ERROR_RESPONSES } },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await requireSync().refresh(request.params.id, 'manual')
      reply.code(200)
      return adminOrderService.getOrder(request.params.id)
    }
  )

  app.post<{ Params: { id: string }; Body: { kind: 'waybill' | 'barcode' } }>(
    '/orders/:id/cdek/print',
    {
      preHandler: preHandlers,
      config: { rateLimit: RATE_LIMIT },
      schema: {
        params: ID_PARAMS,
        body: {
          type: 'object',
          required: ['kind'],
          additionalProperties: false,
          properties: { kind: { type: 'string', enum: ['waybill', 'barcode'] } },
        },
        response: ERROR_RESPONSES,
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { kind: 'waybill' | 'barcode' } }>, reply: FastifyReply) => {
      const body = printSchema.safeParse(request.body)
      if (!body.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      const order = await adminOrderService.getOrder(request.params.id)
      const pdf = await requireSync().print(request.params.id, body.data.kind)
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="cdek-${order.number}-${body.data.kind}.pdf"`)
        .header('Cache-Control', 'no-store')
        .send(pdf)
    }
  )
}
