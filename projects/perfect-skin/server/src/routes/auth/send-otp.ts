import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { otpService } from '../../services/otp.service.js'
import { createMailSender } from '../../services/mail/index.js'
import { ApiError } from '../../lib/errors.js'

const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(254),
})

export async function sendOtpRoute(app: FastifyInstance) {
  const mail = createMailSender()

  app.post<{ Body: { email: string } }>(
    '/api/v1/auth/send-otp',
    {
      // Контракт 3.18: 5 запросов / 15 минут по IP (плюс лимит на email внутри).
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['channel', 'expiresIn', 'resendAfter'],
            properties: {
              channel: { type: 'string', const: 'email' },
              expiresIn: { type: 'integer' },
              resendAfter: { type: 'integer' },
            },
          },
          400: { $ref: 'ps.error#' },
          429: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { email: string } }>, reply: FastifyReply) => {
      // Validate input
      const result = emailSchema.safeParse(request.body as any)
      if (!result.success) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Неверный формат email',
          { field: 'email' }
        )
      }

      const email = result.data.email

      // Пользователь нужен до проверки лимита: код в БД привязан к userId,
      // поля email у OtpCode нет.
      const user = await otpService.findOrCreateUser(email)

      // Check rate limit per email (60 sec)
      const { db } = await import('../../lib/db.js')
      const recentCode = await db.otpCode.findFirst({
        where: {
          userId: user.id,
          createdAt: { gte: new Date(Date.now() - 60 * 1000) },
        },
      })

      if (recentCode) {
        throw new ApiError(
          429,
          'OTP_RATE_LIMITED',
          'Слишком частый запрос. Попробуйте позже',
          { retryAfter: 60 }
        )
      }

      // Generate and send OTP
      const code = await otpService.generateAndStoreCode(user.id, 'email')
      await mail.send(email, code)

      reply.status(200).send({
        channel: 'email',
        expiresIn: 10 * 60,
        resendAfter: 60,
      })
    }
  )
}
