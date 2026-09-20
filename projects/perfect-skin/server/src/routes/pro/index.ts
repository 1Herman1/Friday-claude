import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ApiError } from '../../lib/errors.js'

const applySchema = z.object({
  companyName: z.string().min(2).max(120),
  inn: z.string().regex(/^\d{10}$|^\d{12}$|^\d{15}$/, 'ИНН должен быть 10, 12 или 15 цифр'),
  specialization: z.string().min(2).max(120),
  comment: z.string().max(500).optional(),
})

export default async function proRoute(app: FastifyInstance) {
  // POST /api/v1/pro/apply
  app.post(
    '/api/v1/pro/apply',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 hour',
          keyGenerator: (req) => req.user?.id ?? req.ip,
        },
      },
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['proStatus'],
            properties: {
              proStatus: { type: 'string', enum: ['pending', 'approved', 'rejected', 'none'] },
            },
          },
          400: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const result = applySchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Ошибка валидации',
          { field: result.error.issues[0]?.path[0] }
        )
      }

      const { companyName, inn, specialization, comment } = result.data

      // Check if user already has a professional status request pending or approved
      const user = await app.prisma.user.findUnique({
        where: { id: request.user!.id },
        select: { proStatus: true, acceptedTermsAt: true },
      })

      if (user?.proStatus === 'pending') {
        throw new ApiError(409, 'PRO_ALREADY_REQUESTED', 'Заявка уже подана')
      }

      if (user?.proStatus === 'approved') {
        throw new ApiError(409, 'PRO_ALREADY_APPROVED', 'Ваш статус специалиста уже подтвержден')
      }

      // Update user with professional request data
      const updateData: any = {
        proStatus: 'pending',
        companyName,
        inn,
        specialization,
        proRequestedAt: new Date(),
        proRejectReason: null,
        proReviewedAt: null,
      }

      // Mark consent date on first pro request only (if not already marked)
      if (!user?.acceptedTermsAt) {
        updateData.acceptedTermsAt = new Date()
      }

      const updatedUser = await app.prisma.user.update({
        where: { id: request.user!.id },
        data: updateData,
        select: { proStatus: true },
      })

      reply.status(200).send({
        proStatus: updatedUser.proStatus,
      })
    }
  )

  // GET /api/v1/pro/status
  app.get(
    '/api/v1/pro/status',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['proStatus', 'companyName', 'inn', 'specialization', 'proRequestedAt', 'proReviewedAt', 'proRejectReason'],
            properties: {
              proStatus: { type: 'string', enum: ['none', 'pending', 'approved', 'rejected'] },
              companyName: { type: ['string', 'null'] },
              inn: { type: ['string', 'null'] },
              specialization: { type: ['string', 'null'] },
              proRequestedAt: { type: ['string', 'null'] },
              proReviewedAt: { type: ['string', 'null'] },
              proRejectReason: { type: ['string', 'null'] },
            },
          },
          401: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const user = await app.prisma.user.findUnique({
        where: { id: request.user!.id },
        select: {
          proStatus: true,
          companyName: true,
          inn: true,
          specialization: true,
          proRequestedAt: true,
          proReviewedAt: true,
          proRejectReason: true,
        },
      })

      if (!user) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'Пользователь не найден')
      }

      reply.status(200).send({
        proStatus: user.proStatus || 'none',
        companyName: user.companyName || null,
        inn: user.inn || null,
        specialization: user.specialization || null,
        proRequestedAt: user.proRequestedAt ? user.proRequestedAt.toISOString() : null,
        proReviewedAt: user.proReviewedAt ? user.proReviewedAt.toISOString() : null,
        proRejectReason: user.proRejectReason || null,
      })
    }
  )
}
