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

export default fastifyPlugin(async (app: FastifyInstance) => {
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
