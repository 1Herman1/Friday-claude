import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fastifyPlugin from 'fastify-plugin'
import { z } from 'zod'
import { bonusService } from '../../services/bonus.service.js'
import { cartService } from '../../services/cart.service.js'
import { ApiError } from '../../lib/errors.js'
import { viewerFromRequest } from '../../lib/pricing.js'

const checkoutQuerySchema = z.object({
  promo: z
    .string()
    .trim()
    .max(32)
    .regex(/^[A-Za-z0-9_-]*$/)
    .optional()
    .transform((value) => value || undefined),
  spend: z.coerce.number().int().min(0).max(1_000_000).optional(),
})

const transactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

const membershipBodySchema = z.object({
  acceptRules: z.literal(true),
})

export default fastifyPlugin(async (app: FastifyInstance) => {
  // GET /api/v1/bonus — сводка: программа, участие, баланс, ближайшее сгорание, правила
  app.get(
    '/api/v1/bonus',
    {
      schema: {
        response: {
          200: { $ref: 'ps.bonusSummary#' },
          401: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticate,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      reply.header('Cache-Control', 'no-store')
      const summary = await bonusService.getSummary(request.user!.id, viewerFromRequest(request), new Date())
      reply.status(200).send(summary)
    }
  )

  // GET /api/v1/bonus/transactions — история своего счёта
  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/api/v1/bonus/transactions',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 50 },
            offset: { type: 'integer', minimum: 0 },
          },
        },
        response: {
          200: { $ref: 'ps.bonusTxList#' },
          400: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticate,
    },
    async (request: FastifyRequest<{ Querystring: { limit?: string; offset?: string } }>, reply: FastifyReply) => {
      reply.header('Cache-Control', 'no-store')
      const parsed = transactionsQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Неверные данные', {
          field: String(parsed.error.issues[0]?.path[0] ?? ''),
        })
      }
      const page = await bonusService.listTransactions(request.user!.id, parsed.data)
      reply.status(200).send(page)
    }
  )

  // POST /api/v1/bonus/membership — вступить: принятие Правил пишется согласием loyalty
  app.post<{ Body: { acceptRules?: boolean } }>(
    '/api/v1/bonus/membership',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 hour',
          keyGenerator: (req: any) => req.user?.id ?? req.ip,
        },
      },
      schema: {
        response: {
          200: { $ref: 'ps.bonusSummary#' },
          400: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticate,
    },
    async (request: FastifyRequest<{ Body: { acceptRules?: boolean } }>, reply: FastifyReply) => {
      reply.header('Cache-Control', 'no-store')
      const parsed = membershipBodySchema.safeParse(request.body)
      if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Примите Правила Бьюти-клуба', { field: 'acceptRules' })
      }
      const userId = request.user!.id
      const viewer = viewerFromRequest(request)
      const now = new Date()
      await bonusService.join(userId, viewer, now)
      reply.status(200).send(await bonusService.getSummary(userId, viewer, now))
    }
  )

  // DELETE /api/v1/bonus/membership — выйти из клуба; остаток замораживается
  app.delete(
    '/api/v1/bonus/membership',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 hour',
          keyGenerator: (req: any) => req.user?.id ?? req.ip,
        },
      },
      schema: {
        response: {
          200: { $ref: 'ps.bonusSummary#' },
          401: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticate,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      reply.header('Cache-Control', 'no-store')
      const userId = request.user!.id
      const now = new Date()
      await bonusService.leave(userId, now)
      reply.status(200).send(await bonusService.getSummary(userId, viewerFromRequest(request), now))
    }
  )

  // GET /api/v1/bonus/checkout — лимит списания и прогноз начисления по текущей корзине
  app.get<{ Querystring: { promo?: string; spend?: string } }>(
    '/api/v1/bonus/checkout',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
          keyGenerator: (req: any) => req.user?.id ?? req.cookies?.ps_sid ?? req.ip,
        },
      },
      schema: {
        querystring: {
          type: 'object',
          properties: {
            promo: { type: 'string', maxLength: 32 },
            spend: { type: 'integer', minimum: 0, maximum: 1000000 },
          },
        },
        response: {
          200: { $ref: 'ps.bonusCheckout#' },
          400: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticateOptional,
    },
    async (request: FastifyRequest<{ Querystring: { promo?: string; spend?: string } }>, reply: FastifyReply) => {
      reply.header('Cache-Control', 'no-store')

      const parsed = checkoutQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Неверные данные', {
          field: String(parsed.error.issues[0]?.path[0] ?? ''),
        })
      }

      const owner = cartService.resolveCartOwner(request)
      if (!owner) throw new ApiError(409, 'CART_EMPTY', 'Корзина пуста')

      const quote = await bonusService.quoteForCart(
        owner,
        viewerFromRequest(request),
        parsed.data.promo,
        parsed.data.spend ?? 0,
        new Date()
      )
      reply.status(200).send(quote)
    }
  )
})
