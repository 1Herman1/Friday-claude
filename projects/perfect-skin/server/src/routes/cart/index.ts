import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fastifyPlugin from 'fastify-plugin'
import { z } from 'zod'
import { cartService } from '../../services/cart.service.js'
import { ApiError } from '../../lib/errors.js'

export default fastifyPlugin(async (app: FastifyInstance) => {
  // GET /cart
  app.get<{ Reply: any }>(
    '/api/v1/cart',
    {
      schema: {
        response: {
          200: { $ref: 'ps.cart#' },
        },
      },
      preHandler: app.authenticateOptional,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      reply.header('Cache-Control', 'no-store')

      const owner = cartService.resolveCartOwner(request)
      if (!owner) {
        // Return empty cart for guest
        return reply.status(200).send({
          id: null,
          items: [],
          itemsCount: 0,
          subtotal: 0,
          warnings: [],
        })
      }

      const cart = await cartService.getOrCreateCart(owner)
      if (!cart) {
        return reply.status(200).send({
          id: null,
          items: [],
          itemsCount: 0,
          subtotal: 0,
          warnings: [],
        })
      }

      const formatted = cartService.formatCartResponse(cart)
      reply.status(200).send(formatted)
    }
  )

  // POST /cart/items
  app.post<{ Body: { variantId: string; quantity: number }; Reply: any }>(
    '/api/v1/cart/items',
    {
      // Контракт 3.11: 60/мин по IP.
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        body: {
          type: 'object',
          required: ['variantId', 'quantity'],
          properties: {
            variantId: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer', minimum: 1, maximum: 99 },
          },
        },
        response: {
          201: { $ref: 'ps.cart#' },
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
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
      })

      const result = bodySchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Неверные данные',
          { field: result.error.issues[0]?.path[0] }
        )
      }

      const { variantId, quantity } = result.data

      // Create owner for guest if needed (will create sessionId and cookie)
      let owner = cartService.resolveCartOwner(request)
      if (!owner) {
        const { randomUUID } = await import('crypto')
        const sessionId = randomUUID()
        owner = { sessionId }

        reply.setCookie('ps_sid', sessionId, {
          signed: true,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 180 * 24 * 3600,
        })
      }

      const cart = await cartService.addItem(owner, variantId, quantity)
      reply.status(201).send(cart)
    }
  )

  // PATCH /cart/items/:itemId
  app.patch<{ Params: { itemId: string }; Body: { quantity: number }; Reply: any }>(
    '/api/v1/cart/items/:itemId',
    {
      schema: {
        body: {
          type: 'object',
          required: ['quantity'],
          properties: {
            quantity: { type: 'integer', minimum: 0, maximum: 99 },
          },
        },
        response: {
          200: { $ref: 'ps.cart#' },
          400: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticateOptional,
    },
    async (request: FastifyRequest<{ Params: { itemId: string }; Body: { quantity: number } }>, reply: FastifyReply) => {
      const bodySchema = z.object({
        quantity: z.number().int().min(0).max(99),
      })

      const result = bodySchema.safeParse(request.body as any)
      if (!result.success) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Неверные данные',
          { field: 'quantity' }
        )
      }

      const owner = cartService.resolveCartOwner(request)
      if (!owner) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Требуется авторизация')
      }

      const { itemId } = request.params
      const cart = await cartService.updateItem(owner, itemId, result.data.quantity)
      reply.status(200).send(cart)
    }
  )

  // DELETE /cart/items/:itemId
  app.delete<{ Params: { itemId: string }; Reply: any }>(
    '/api/v1/cart/items/:itemId',
    {
      schema: {
        response: {
          200: { $ref: 'ps.cart#' },
          404: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticateOptional,
    },
    async (request: FastifyRequest<{ Params: { itemId: string } }>, reply: FastifyReply) => {
      const owner = cartService.resolveCartOwner(request)
      if (!owner) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Требуется авторизация')
      }

      const { itemId } = request.params as { itemId: string }
      const cart = await cartService.deleteItem(owner, itemId)
      reply.status(200).send(cart)
    }
  )

  // DELETE /cart
  app.delete<{ Reply: any }>(
    '/api/v1/cart',
    {
      schema: {
        response: {
          200: { $ref: 'ps.cart#' },
        },
      },
      preHandler: app.authenticateOptional,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const owner = cartService.resolveCartOwner(request)
      if (!owner) {
        // Return empty cart
        return reply.status(200).send({
          id: null,
          items: [],
          itemsCount: 0,
          subtotal: 0,
          warnings: [],
        })
      }

      const cart = await cartService.clearCart(owner)
      reply.status(200).send(cart)
    }
  )
})
