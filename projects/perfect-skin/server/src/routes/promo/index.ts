import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fastifyPlugin from 'fastify-plugin'
import { z } from 'zod'
import { promoService } from '../../services/promo.service.js'
import { cartService } from '../../services/cart.service.js'
import { ApiError } from '../../lib/errors.js'

export default fastifyPlugin(async (app: FastifyInstance) => {
  app.post<{ Body: { code: string }; Reply: any }>(
    '/api/v1/promo/validate',
    {
      // Контракт 3.15: 20/мин по IP — защита от перебора кодов.
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        body: {
          type: 'object',
          required: ['code'],
          properties: {
            code: {
              type: 'string',
              minLength: 3,
              maxLength: 32,
            },
          },
        },
        response: {
          200: { $ref: 'ps.promoResponse#' },
          400: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticateOptional,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Validate input
      const bodySchema = z.object({
        code: z
          .string()
          .trim()
          .min(3)
          .max(32)
          .regex(/^[A-Za-z0-9_-]+$/),
      })

      const result = bodySchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Неверный формат кода',
          { field: 'code' }
        )
      }

      // Get cart and calculate subtotal
      const owner = cartService.resolveCartOwner(request)
      if (!owner) {
        throw new ApiError(409, 'CART_EMPTY', 'Корзина пуста')
      }

      const cart = await cartService.getOrCreateCart(owner)
      if (!cart || cart.items.length === 0) {
        throw new ApiError(409, 'CART_EMPTY', 'Корзина пуста')
      }

      // Calculate subtotal
      const subtotal = cart.items.reduce((sum: number, item: any) => {
        return sum + item.productVariant.retailPrice * item.quantity
      }, 0)

      // Validate promo
      const promoResponse = await promoService.validateCode(result.data.code, subtotal)
      reply.status(200).send(promoResponse)
    }
  )
})
