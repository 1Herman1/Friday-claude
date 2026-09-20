import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { ApiError } from '../../lib/errors.js'
import { createMailSender } from '../../services/mail/index.js'

const listQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).optional().default('pending'),
  skip: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

const patchSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
})

export async function proRequestsRoutes(app: FastifyInstance, preHandlers: any[]) {
  // GET /api/v1/admin/pro-requests
  app.get(
    '/pro-requests',
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
                  required: ['id', 'name', 'email', 'phone', 'companyName', 'inn', 'specialization', 'proStatus', 'proRequestedAt', 'proReviewedAt', 'proRejectReason'],
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    email: { type: ['string', 'null'] },
                    phone: { type: ['string', 'null'] },
                    companyName: { type: 'string' },
                    inn: { type: 'string' },
                    specialization: { type: 'string' },
                    proStatus: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
                    proRequestedAt: { type: 'string', format: 'date-time' },
                    proReviewedAt: { type: ['string', 'null'], format: 'date-time' },
                    proRejectReason: { type: ['string', 'null'] },
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

      const where: any = { deletedAt: null }
      // «Все» — только те, кто подавал заявку; пользователи без заявки (none) не нужны.
      if (status !== 'all') {
        where.proStatus = status
      } else {
        where.proStatus = { not: 'none' }
      }

      const [items, total] = await Promise.all([
        app.prisma.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            companyName: true,
            inn: true,
            specialization: true,
            proStatus: true,
            proRequestedAt: true,
            proReviewedAt: true,
            proRejectReason: true,
          },
          orderBy: { proRequestedAt: 'desc' },
          skip,
          take: limit,
        }),
        app.prisma.user.count({ where }),
      ])

      const formattedItems = items.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email || null,
        phone: u.phone || null,
        companyName: u.companyName || '',
        inn: u.inn || '',
        specialization: u.specialization || '',
        proStatus: u.proStatus,
        proRequestedAt: u.proRequestedAt?.toISOString() || '',
        proReviewedAt: u.proReviewedAt ? u.proReviewedAt.toISOString() : null,
        proRejectReason: u.proRejectReason || null,
      }))

      reply.status(200).send({
        items: formattedItems,
        total,
        skip,
        limit,
      })
    }
  )

  // PATCH /api/v1/admin/pro-requests/:id
  app.patch(
    '/pro-requests/:id',
    {
      preHandler: preHandlers,
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'name', 'email', 'phone', 'companyName', 'inn', 'specialization', 'proStatus', 'proRequestedAt', 'proReviewedAt', 'proRejectReason'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              email: { type: ['string', 'null'] },
              phone: { type: ['string', 'null'] },
              companyName: { type: 'string' },
              inn: { type: 'string' },
              specialization: { type: 'string' },
              proStatus: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
              proRequestedAt: { type: 'string', format: 'date-time' },
              proReviewedAt: { type: ['string', 'null'], format: 'date-time' },
              proRejectReason: { type: ['string', 'null'] },
            },
          },
          400: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const result = patchSchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации', { field: result.error.issues[0]?.path[0] })
      }

      const { action, reason } = result.data

      // Get user
      const user = await app.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          proStatus: true,
          companyName: true,
          inn: true,
          specialization: true,
          createdAt: true,
        },
      })

      if (!user) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'Пользователь не найден')
      }

      // Check if user is staff (has admin/manager role)
      const staffRoles = ['super_admin', 'orders_manager', 'products_manager', 'content_manager']
      if (staffRoles.includes(user.role)) {
        throw new ApiError(409, 'PRO_STAFF_ACCOUNT', 'Сотрудники не могут быть специалистами')
      }

      // Check if application is pending (or allow reject for approved)
      if (action === 'reject' && user.proStatus !== 'pending' && user.proStatus !== 'approved') {
        throw new ApiError(409, 'PRO_NOT_PENDING', 'Заявка не на рассмотрении')
      }

      if (action === 'approve' && user.proStatus !== 'pending') {
        throw new ApiError(409, 'PRO_NOT_PENDING', 'Заявка не на рассмотрении')
      }

      // Check if reject requires reason
      if (action === 'reject' && !reason) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'При отклонении требуется указать причину', { field: 'reason' })
      }

      // Update user
      const updatedUser = await app.prisma.user.update({
        where: { id },
        data: {
          proStatus: action === 'approve' ? 'approved' : 'rejected',
          role: action === 'approve' ? 'professional' : (user.role === 'professional' ? 'customer' : user.role),
          proReviewedAt: new Date(),
          proReviewerId: request.user!.id,
          proRejectReason: action === 'reject' ? reason : null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          companyName: true,
          inn: true,
          specialization: true,
          proStatus: true,
          proRequestedAt: true,
          proReviewedAt: true,
          proRejectReason: true,
        },
      })

      // Send email to user
      if (updatedUser.email) {
        const mailSender = createMailSender()
        const subject = action === 'approve'
          ? 'Статус специалиста подтвержден'
          : 'Статус специалиста отклонен'
        const text = action === 'approve'
          ? 'Ваш статус специалиста подтвержден. Теперь в каталоге Perfect Skin вам показаны профессиональные цены.'
          : `Заявка на статус специалиста отклонена. Причина: ${reason}`

        try {
          await mailSender.sendPlain(updatedUser.email, subject, text)
        } catch (error) {
          app.log.warn({ email: updatedUser.email, action, error }, 'Failed to send professional status email')
        }
      }

      reply.status(200).send({
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email || null,
        phone: updatedUser.phone || null,
        companyName: updatedUser.companyName || '',
        inn: updatedUser.inn || '',
        specialization: updatedUser.specialization || '',
        proStatus: updatedUser.proStatus,
        proRequestedAt: updatedUser.proRequestedAt?.toISOString() || '',
        proReviewedAt: updatedUser.proReviewedAt ? updatedUser.proReviewedAt.toISOString() : null,
        proRejectReason: updatedUser.proRejectReason || null,
      })
    }
  )
}
