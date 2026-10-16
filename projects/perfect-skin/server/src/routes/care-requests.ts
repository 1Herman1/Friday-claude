import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ApiError } from '../lib/errors.js'
import { CONSENT_TEXT_VERSION } from '../lib/consents.js'
import { careSchema } from '../lib/care-schema.js'
import { proNotifyEmail } from '../lib/env.js'
import { createMailSender } from '../services/mail/index.js'

export default async function careRequestsRoute(app: FastifyInstance) {
  // POST /api/v1/care-requests — заявка в Отдел заботы
  app.post(
    '/api/v1/care-requests',
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
            required: ['ok'],
            properties: {
              ok: { type: 'boolean' },
            },
          },
          400: { $ref: 'ps.error#' },
          429: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const validation = careSchema.safeParse(request.body)
      if (!validation.success) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Ошибка валидации',
          { field: validation.error.issues[0]?.path[0] }
        )
      }

      const { name, phone, channel, consentMarketing } = validation.data
      const userId = request.user?.id
      const marketing = consentMarketing === 'true'

      const consents: { purpose: 'care' | 'marketing'; textVersion: string }[] = [
        { purpose: 'care', textVersion: CONSENT_TEXT_VERSION.care },
      ]
      if (marketing) {
        consents.push({ purpose: 'marketing', textVersion: CONSENT_TEXT_VERSION.care_marketing })
      }

      const careId = await app.prisma.$transaction(async (tx) => {
        const care = await tx.consultationRequest.create({
          data: {
            userId: userId || undefined,
            name,
            phone,
            channel,
            source: 'care',
            consentVersion: marketing
              ? `${CONSENT_TEXT_VERSION.care}+${CONSENT_TEXT_VERSION.care_marketing}`
              : CONSENT_TEXT_VERSION.care,
            consentedAt: new Date(),
          },
        })

        // Согласия отправителя — для любого, включая гостя
        await tx.consultationConsent.createMany({
          data: consents.map((c) => ({
            consultationId: care.id,
            ...c,
            ip: request.ip,
            form: 'care',
          })),
        })

        if (userId) {
          await tx.consentRecord.createMany({
            data: consents.map((c) => ({ userId, ...c })),
          })
        }

        return care.id
      })

      // После коммита: уведомления без ПДн, ответ не ждём
      if (proNotifyEmail) {
        const channelLabel = channel === 'phone' ? 'Телефон' : channel === 'telegram' ? 'Telegram' : 'WhatsApp'
        const text = `Новая заявка в Отдел заботы

Канал: ${channelLabel}
Ссылка: /admin/consultations

Получена: ${new Date().toISOString()}`

        createMailSender()
          .sendPlain(proNotifyEmail, 'Новая заявка в Отдел заботы', text)
          .catch((err) => {
            app.log.warn({ err }, 'Failed to send care request notification email')
          })
      }

      app.telegram.onNewConsultation(careId).catch((err) => {
        app.log.warn({ err, care_request_id: careId }, 'Failed to send Telegram notification for care request')
      })

      reply.status(200).send({ ok: true })
    }
  )
}
