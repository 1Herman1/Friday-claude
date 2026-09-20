import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { adminPromoService } from '../../services/admin-promo.service.js'
import { ApiError } from '../../lib/errors.js'

const createPartnerSchema = z.object({
  name: z.string().min(1).max(100),
  contact: z.string().max(255).optional(),
  commissionPercent: z.number().int().min(0).max(100),
})

const updatePartnerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  contact: z.string().max(255).optional(),
  commissionPercent: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
})

const createPromoCodeSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  percent: z.number().int().min(0).max(100),
  partnerId: z.string().uuid().optional(),
  maxRedemptions: z.number().int().min(1).optional(),
  minOrderAmount: z.number().int().min(0).optional(),
  startsAt: z.string().datetime().optional().transform((v) => (v ? new Date(v) : undefined)),
  expiresAt: z.string().datetime().optional().transform((v) => (v ? new Date(v) : undefined)),
})

const updatePromoCodeSchema = z.object({
  percent: z.number().int().min(0).max(100).optional(),
  partnerId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  maxRedemptions: z.number().int().min(1).optional().nullable(),
  minOrderAmount: z.number().int().min(0).optional().nullable(),
  startsAt: z.string().datetime().optional().transform((v) => (v ? new Date(v) : undefined)),
  expiresAt: z.string().datetime().optional().transform((v) => (v ? new Date(v) : undefined)),
})

const reportQuerySchema = z.object({
  from: z.string().datetime().transform((v) => new Date(v)),
  to: z.string().datetime().transform((v) => new Date(v)),
})

export async function promoRoutes(app: FastifyInstance, preHandlers: any[]) {
  // ──────────────────────────────── Партнёры ────────────────────────────────

  // GET /api/v1/admin/partners
  app.get<{ Reply: any }>(
    '/partners',
    {
      preHandler: preHandlers,
      schema: {
        response: {
          200: {
            type: 'array',
            items: { $ref: 'ps.adminPartner#' },
          },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const partners = await adminPromoService.listPartners()
      reply.code(200)
      return partners
    }
  )

  // POST /api/v1/admin/partners
  app.post<{ Body: any; Reply: any }>(
    '/partners',
    {
      preHandler: preHandlers,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'commissionPercent'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            contact: { type: 'string', maxLength: 255 },
            commissionPercent: { type: 'integer', minimum: 0, maximum: 100 },
          },
        },
        response: {
          201: { $ref: 'ps.adminPartner#' },
          400: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      const result = createPartnerSchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const partner = await adminPromoService.createPartner(result.data)
      reply.code(201)
      return partner
    }
  )

  // PATCH /api/v1/admin/partners/:id
  app.patch<{ Params: { id: string }; Body: any; Reply: any }>(
    '/partners/:id',
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
            name: { type: 'string', minLength: 1, maxLength: 100 },
            contact: { type: 'string', maxLength: 255 },
            commissionPercent: { type: 'integer', minimum: 0, maximum: 100 },
            isActive: { type: 'boolean' },
          },
        },
        response: {
          200: { $ref: 'ps.adminPartner#' },
          400: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const result = updatePartnerSchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const partner = await adminPromoService.updatePartner(request.params.id, result.data)
      reply.code(200)
      return partner
    }
  )

  // ──────────────────────────────── Промокоды ────────────────────────────────

  // GET /api/v1/admin/promo-codes
  app.get<{ Reply: any }>(
    '/promo-codes',
    {
      preHandler: preHandlers,
      schema: {
        response: {
          200: {
            type: 'array',
            items: { $ref: 'ps.adminPromoCode#' },
          },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const codes = await adminPromoService.listPromoCodes()
      reply.code(200)
      return codes
    }
  )

  // POST /api/v1/admin/promo-codes
  app.post<{ Body: any; Reply: any }>(
    '/promo-codes',
    {
      preHandler: preHandlers,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['code', 'percent'],
          properties: {
            code: { type: 'string', minLength: 3, maxLength: 20 },
            percent: { type: 'integer', minimum: 0, maximum: 100 },
            partnerId: { type: 'string', format: 'uuid' },
            maxRedemptions: { type: 'integer', minimum: 1 },
            minOrderAmount: { type: 'integer', minimum: 0 },
            startsAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time' },
          },
        },
        response: {
          201: { $ref: 'ps.adminPromoCode#' },
          400: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      const result = createPromoCodeSchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const promoCode = await adminPromoService.createPromoCode(result.data)
      reply.code(201)
      return promoCode
    }
  )

  // PATCH /api/v1/admin/promo-codes/:id
  app.patch<{ Params: { id: string }; Body: any; Reply: any }>(
    '/promo-codes/:id',
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
            percent: { type: 'integer', minimum: 0, maximum: 100 },
            partnerId: { type: ['string', 'null'], format: 'uuid' },
            isActive: { type: 'boolean' },
            maxRedemptions: { type: ['integer', 'null'], minimum: 1 },
            minOrderAmount: { type: ['integer', 'null'], minimum: 0 },
            startsAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time' },
          },
        },
        response: {
          200: { $ref: 'ps.adminPromoCode#' },
          400: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const result = updatePromoCodeSchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const promoCode = await adminPromoService.updatePromoCode(request.params.id, result.data)
      reply.code(200)
      return promoCode
    }
  )

  // ──────────────────────────────── Отчёт ────────────────────────────────

  // GET /api/v1/admin/partners/report
  app.get<{ Querystring: any; Reply: any }>(
    '/partners/report',
    {
      preHandler: preHandlers,
      schema: {
        querystring: {
          type: 'object',
          required: ['from', 'to'],
          properties: {
            from: { type: 'string', format: 'date-time' },
            to: { type: 'string', format: 'date-time' },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['rows', 'totals'],
            properties: {
              rows: {
                type: 'array',
                items: { $ref: 'ps.payoutReportRow#' },
              },
              totals: { $ref: 'ps.payoutReportTotals#' },
            },
          },
          400: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
      const result = reportQuerySchema.safeParse(request.query)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const report = await adminPromoService.generatePayoutReport(result.data.from, result.data.to)
      reply.code(200)
      return report
    }
  )
}
