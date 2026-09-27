import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ApiError } from '../../lib/errors.js'

const listQuerySchema = z.object({
  status: z.enum(['new', 'contacted', 'scheduled', 'done', 'cancelled', 'all']).optional().default('new'),
  skip: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

const patchSchema = z.object({
  status: z.enum(['new', 'contacted', 'scheduled', 'done', 'cancelled']),
  adminNote: z.string().max(1000).optional(),
})

export async function consultationsRoutes(app: FastifyInstance, preHandlers: any[]) {
  // GET /api/v1/admin/consultations
  app.get(
    '/consultations',
    {
      preHandler: preHandlers,
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['items', 'total', 'skip', 'limit'],
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['id', 'name', 'phone', 'email', 'channel', 'message', 'skinType', 'concern', 'source', 'status', 'adminNote', 'createdAt', 'updatedAt'],
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    phone: { type: 'string' },
                    email: { type: ['string', 'null'] },
                    channel: { type: ['string', 'null'] },
                    message: { type: ['string', 'null'] },
                    skinType: { type: ['string', 'null'] },
                    concern: { type: ['string', 'null'] },
                    source: { type: ['string', 'null'] },
                    status: { type: 'string', enum: ['new', 'contacted', 'scheduled', 'done', 'cancelled'] },
                    adminNote: { type: ['string', 'null'] },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
              total: { type: 'integer' },
              skip: { type: 'integer' },
              limit: { type: 'integer' },
            },
          },
          400: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      const result = listQuerySchema.safeParse(request.query)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации', { field: result.error.issues[0]?.path[0] })
      }

      const { status, skip, limit } = result.data

      const where: any = {}
      if (status !== 'all') {
        where.status = status
      }

      const [items, total] = await Promise.all([
        app.prisma.consultationRequest.findMany({
          where,
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            channel: true,
            message: true,
            skinType: true,
            concern: true,
            source: true,
            status: true,
            adminNote: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        app.prisma.consultationRequest.count({ where }),
      ])

      const formattedItems = items.map((item) => ({
        id: item.id,
        name: item.name,
        phone: item.phone,
        email: item.email || null,
        channel: item.channel || null,
        message: item.message || null,
        skinType: item.skinType || null,
        concern: item.concern || null,
        source: item.source || null,
        status: item.status,
        adminNote: item.adminNote || null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      }))

      reply.status(200).send({
        items: formattedItems,
        total,
        skip,
        limit,
      })
    }
  )

  // PATCH /api/v1/admin/consultations/:id
  app.patch(
    '/consultations/:id',
    {
      preHandler: preHandlers,
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['ok'],
            properties: {
              ok: { type: 'boolean' },
            },
          },
          400: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const validation = patchSchema.safeParse(request.body)
      if (!validation.success) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Ошибка валидации',
          { field: validation.error.issues[0]?.path[0] }
        )
      }

      const { status, adminNote } = validation.data

      const updated = await app.prisma.consultationRequest.update({
        where: { id },
        data: {
          status,
          adminNote: adminNote || null,
        },
      })

      if (!updated) {
        throw new ApiError(404, 'NOT_FOUND', 'Заявка не найдена')
      }

      reply.status(200).send({ ok: true })
    }
  )
}
