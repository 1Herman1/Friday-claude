import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fastifyPlugin from 'fastify-plugin'
import { z } from 'zod'
import { orderService } from '../../services/order.service.js'
import { cartService } from '../../services/cart.service.js'
import { otpService } from '../../services/otp.service.js'
import { db } from '../../lib/db.js'
import { ApiError } from '../../lib/errors.js'

const createOrderSchema = z.object({
  deliveryMethod: z.enum(['pickup', 'cdek_pvz', 'cdek_courier']),
  cdekPvzCode: z.string().min(2).max(20).regex(/^[A-Z0-9-]+$/).optional(),
  address: z
    .object({
      city: z.string().min(2).max(80),
      street: z.string().min(2).max(120),
      house: z.string().min(1).max(20),
      apartment: z.string().max(20).optional(),
      postalCode: z.string().regex(/^\d{6}$/),
    })
    .nullable()
    .optional(),
  recipient: z.object({
    name: z.string().min(2).max(80),
    phone: z.string().regex(/^\+7\d{10}$/),
    email: z.string().email().optional(),
  }),
  promoCode: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  comment: z.string().max(500).optional(),
  expectedTotal: z.number().int().min(0),
})

export default fastifyPlugin(async (app: FastifyInstance) => {
  // POST /orders - Create order
  app.post<{ Body: any; Reply: any }>(
    '/api/v1/orders',
    {
      // Контракт 3.16: 10/час на пользователя (вошедшего) или на IP (гостя).
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 hour',
          keyGenerator: (req: any) => req.user?.id ?? req.cookies?.ps_sid ?? req.ip,
        },
      },
      schema: {
        body: {
          type: 'object',
          required: ['deliveryMethod', 'recipient', 'expectedTotal'],
          properties: {
            deliveryMethod: { type: 'string', enum: ['pickup', 'cdek_pvz', 'cdek_courier'] },
            cdekPvzCode: { type: 'string', minLength: 2, maxLength: 20 },
            address: {
              type: ['object', 'null'],
              properties: {
                city: { type: 'string' },
                street: { type: 'string' },
                house: { type: 'string' },
                apartment: { type: 'string' },
                postalCode: { type: 'string' },
              },
            },
            recipient: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                phone: { type: 'string' },
                email: { type: 'string' },
              },
            },
            promoCode: { type: 'string' },
            comment: { type: 'string' },
            expectedTotal: { type: 'integer' },
          },
        },
        response: {
          201: { $ref: 'ps.order#' },
          400: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticateOptional,
    },
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      // Validate input
      const result = createOrderSchema.safeParse(request.body as any)
      if (!result.success) {
        const issue = result.error.issues[0]
        const body = request.body as any
        if (issue.path[0] === 'cdekPvzCode' && !body.cdekPvzCode && body.deliveryMethod === 'cdek_pvz') {
          throw new ApiError(400, 'PVZ_CODE_REQUIRED', 'Код ПВЗ требуется для данного способа доставки')
        }
        if (issue.path[0] === 'address' && !body.address && body.deliveryMethod === 'cdek_courier') {
          throw new ApiError(400, 'ADDRESS_REQUIRED', 'Адрес требуется для курьерской доставки')
        }
        throw new ApiError(400, 'VALIDATION_ERROR', 'Неверные данные', {
          field: String(issue.path[0]),
        })
      }

      // Determine order owner: authenticated user or guest
      let customerId: string
      let cartOwner: { userId: string } | { sessionId: string }

      if (request.user?.id) {
        // Вошедший пользователь
        customerId = request.user.id
        cartOwner = { userId: request.user.id }
      } else {
        // Гость — требуется email в recipient
        const recipientEmail = result.data.recipient.email
        if (!recipientEmail) {
          throw new ApiError(
            400,
            'EMAIL_REQUIRED',
            'Укажите email — на него придёт подтверждение заказа'
          )
        }

        // Find or create customer by email
        const normalizedEmail = recipientEmail.trim().toLowerCase()
        customerId = (await otpService.findOrCreateUser(normalizedEmail)).id

        // Resolve cart owner from session
        const cartOwnerResolved = cartService.resolveCartOwner(request)
        if (!cartOwnerResolved) {
          throw new ApiError(409, 'CART_EMPTY', 'Корзина пуста')
        }
        cartOwner = cartOwnerResolved
      }

      const owner = { customerId, cart: cartOwner }
      const order = await orderService.createOrder(owner, result.data)

      reply.status(201).send(order)
    }
  )

  // GET /orders - List orders
  app.get<{ Querystring: { limit?: string; offset?: string }; Reply: any }>(
    '/api/v1/orders',
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
          200: { $ref: 'ps.ordersList#' },
          401: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticate,
    },
    async (request: FastifyRequest<{ Querystring: { limit?: string; offset?: string } }>, reply: FastifyReply) => {
      reply.header('Cache-Control', 'no-store')

      const limit = Math.min(parseInt((request.query as any)?.limit as string) || 20, 50)
      const offset = parseInt((request.query as any)?.offset as string) || 0

      const [orders, total] = await Promise.all([
        db.order.findMany({
          where: { userId: request.user!.id },
          include: { items: { include: { product: { select: { slug: true, images: true } } } } },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        db.order.count({
          where: { userId: request.user!.id },
        }),
      ])

      const items = orders.map((order: any) => ({
        id: order.id,
        number: order.number,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        total: order.total,
        itemsCount: order.items.length,
        previewImages: order.items
          .slice(0, 3)
          .map((item: any) => item.image)
          .filter(Boolean),
      }))

      reply.status(200).send({
        items,
        total,
        limit,
        offset,
      })
    }
  )


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

  // GET /orders/:number - Get single order
  app.get<{ Params: { number: string }; Reply: any }>(
    '/api/v1/orders/:number',
    {
      schema: {
        params: {
          type: 'object',
          required: ['number'],
          properties: {
            number: { type: 'string', pattern: '^PS-\\d{6}$' },
          },
        },
        response: {
          200: { $ref: 'ps.order#' },
          401: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticate,
    },
    async (request: FastifyRequest<{ Params: { number: string } }>, reply: FastifyReply) => {
      reply.header('Cache-Control', 'no-store')

      const order = await db.order.findUnique({
        where: { number: (request.params as any)?.number },
        include: {
          items: { include: { product: { select: { slug: true, images: true } } } },
          redemption: { include: { promoCode: { select: { code: true, percent: true } } } },
        },
      })

      if (!order || order.userId !== request.user!.id) {
        throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден')
      }

      const formatted = orderService.formatOrderResponse(order)
      reply.status(200).send(formatted)
    }
  )
})
