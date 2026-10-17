import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { ApiError } from '../../lib/errors.js'
import { activeRetailMarketingWhere, grantRetailMarketing, revokeMarketingConsents } from '../../lib/account-consents.js'

const marketingSchema = z.object({
  consent: z.boolean(),
})

const consentResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['consent'],
  properties: {
    consent: { type: 'boolean' },
  },
}

const rateLimit = {
  max: 30,
  timeWindow: '15 minutes',
  keyGenerator: (req: FastifyRequest) => req.user?.id ?? req.ip,
}

export async function marketingConsentRoute(app: FastifyInstance) {
  // GET /api/v1/auth/me/marketing — есть ли активное согласие покупателя на рекламу
  // (рассылка специалистам здесь не учитывается)
  app.get(
    '/api/v1/auth/me/marketing',
    {
      config: { rateLimit },
      schema: {
        response: {
          200: consentResponse,
          401: { $ref: 'ps.error#' },
          429: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const active = await app.prisma.consentRecord.findFirst({
        where: activeRetailMarketingWhere(request.user!.id),
        select: { id: true },
      })

      reply.status(200).send({ consent: active !== null })
    }
  )

  // PATCH /api/v1/auth/me/marketing — включить или выключить рекламу в профиле.
  // Выключение снимает все рекламные согласия человека, включая рассылку специалистам и заявки
  app.patch(
    '/api/v1/auth/me/marketing',
    {
      config: { rateLimit },
      schema: {
        response: {
          200: consentResponse,
          400: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          429: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const validation = marketingSchema.safeParse(request.body)
      if (!validation.success) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Ошибка валидации',
          { field: validation.error.issues[0]?.path[0] }
        )
      }

      const { consent } = validation.data
      const user = request.user!

      await app.prisma.$transaction(async (tx) => {
        if (consent) {
          await grantRetailMarketing(tx, user.id)
        } else {
          await revokeMarketingConsents(tx, { userId: user.id, phone: user.phone }, new Date())
        }
      })

      reply.status(200).send({ consent })
    }
  )
}
