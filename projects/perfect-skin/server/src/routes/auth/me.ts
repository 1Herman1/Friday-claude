import type { FastifyInstance } from 'fastify'
import { ApiError } from '../../lib/errors.js'

export async function meRoute(app: FastifyInstance) {
  app.get(
    '/api/v1/auth/me',
    {
      schema: {
        response: {
          200: { $ref: 'ps.user#' },
          401: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      // Fetch full user data including professional fields
      const user = await app.prisma.user.findUnique({
        where: { id: request.user!.id },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
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
        id: user.id,
        name: user.name,
        phone: user.phone || '',
        email: user.email || null,
        role: user.role,
        proStatus: user.proStatus || null,
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
