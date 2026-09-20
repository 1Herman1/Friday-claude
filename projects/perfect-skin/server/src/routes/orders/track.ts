import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '../../lib/db.js'
import { ApiError } from '../../lib/errors.js'
import { orderService } from '../../services/order.service.js'

export async function trackOrderRoute(app: FastifyInstance) {
  // GET /orders/track — публичная проверка заказа по паре «номер + email».
  // Гость отслеживает заказ без входа; единый 404 не раскрывает,
  // существует ли номер.
  app.get<{ Querystring: { number: string; email: string }; Reply: any }>(
    '/api/v1/orders/track',
    {
      config: {
        rateLimit: { max: 20, timeWindow: '15 minutes' },
      },
      schema: {
        querystring: {
          type: 'object',
          required: ['number', 'email'],
          properties: {
            number: { type: 'string', pattern: '^PS-\\d{6}$' },
            email: { type: 'string', format: 'email', maxLength: 254 },
          },
        },
        response: {
          200: { $ref: 'ps.order#' },
          404: { $ref: 'ps.error#' },
          429: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { number: string; email: string } }>, reply: FastifyReply) => {
      reply.header('Cache-Control', 'no-store')

      const { number } = request.query as { number: string; email: string }
      const email = String((request.query as any).email).trim().toLowerCase()

      const order = await db.order.findUnique({
        where: { number },
        include: {
          user: { select: { email: true } },
          items: { include: { product: { select: { slug: true, images: true } } } },
          redemption: { include: { promoCode: { select: { code: true, percent: true } } } },
        },
      })

      if (!order || !order.user?.email || order.user.email.toLowerCase() !== email) {
        throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден')
      }

      const formatted = orderService.formatOrderResponse(order)
      reply.status(200).send(formatted)
    }
  )
}
