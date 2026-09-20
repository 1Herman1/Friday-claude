import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { adminOrderService } from '../../services/admin-order.service.js'
import { ApiError } from '../../lib/errors.js'
import { $Enums } from '../../lib/db.js'

const listOrdersSchema = z.object({
  status: z.enum(['new', 'confirmed', 'packed', 'in_transit', 'delivered', 'cancelled']).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
  dateFrom: z.string().datetime().optional().transform((v) => v ? new Date(v) : undefined),
  dateTo: z.string().datetime().optional().transform((v) => v ? new Date(v) : undefined),
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

const updateOrderSchema = z.object({
  status: z.enum(['new', 'confirmed', 'packed', 'in_transit', 'delivered', 'cancelled']).optional(),
  deliveryTrackNumber: z.string().max(64).optional(),
  adminNote: z.string().max(1000).optional(),
  markPaid: z.boolean().optional(),
})

export async function ordersRoutes(app: FastifyInstance, preHandlers: any[]) {
  // GET /api/v1/admin/orders
  app.get<{ Querystring: any; Reply: any }>(
    '/orders',
    {
      preHandler: preHandlers,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['new', 'confirmed', 'packed', 'in_transit', 'delivered', 'cancelled'] },
            paymentStatus: { type: 'string', enum: ['pending', 'paid', 'failed', 'refunded'] },
            dateFrom: { type: 'string', format: 'date-time' },
            dateTo: { type: 'string', format: 'date-time' },
            search: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            offset: { type: 'integer', minimum: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['items', 'total', 'limit', 'offset'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: 'ps.adminOrder#' },
              },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
            },
          },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
      const result = listOrdersSchema.safeParse(request.query)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const data = await adminOrderService.listOrders({
        status: result.data.status as any,
        paymentStatus: result.data.paymentStatus as any,
        dateFrom: result.data.dateFrom,
        dateTo: result.data.dateTo,
        search: result.data.search,
        limit: result.data.limit,
        offset: result.data.offset,
      })

      reply.code(200)
      return data
    }
  )

  // GET /api/v1/admin/orders/:id
  app.get<{ Params: { id: string }; Reply: any }>(
    '/orders/:id',
    {
      preHandler: preHandlers,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: { $ref: 'ps.adminOrder#' },
          404: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const order = await adminOrderService.getOrder(request.params.id)
      reply.code(200)
      return order
    }
  )

  // PATCH /api/v1/admin/orders/:id
  app.patch<{ Params: { id: string }; Body: any; Reply: any }>(
    '/orders/:id',
    {
      preHandler: preHandlers,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: ['new', 'confirmed', 'packed', 'in_transit', 'delivered', 'cancelled'] },
            deliveryTrackNumber: { type: 'string', maxLength: 64 },
            adminNote: { type: 'string', maxLength: 1000 },
            markPaid: { type: 'boolean' },
          },
        },
        response: {
          200: { $ref: 'ps.adminOrder#' },
          400: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const result = updateOrderSchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const order = await adminOrderService.updateOrder(
        request.params.id,
        result.data,
        request.user!.role as $Enums.UserRole
      )

      reply.code(200)
      return order
    }
  )
}
