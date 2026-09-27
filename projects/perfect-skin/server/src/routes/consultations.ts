import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ApiError } from '../lib/errors.js'
import { CONSENT_TEXT_VERSION } from '../lib/consents.js'
import { consultationSchema } from '../lib/consultation-schema.js'
import { proNotifyEmail } from '../lib/env.js'
import { createMailSender } from '../services/mail/index.js'

export default async function consultationsRoute(app: FastifyInstance) {
  // POST /api/v1/consultations — новая заявка на консультацию
  app.post(
    '/api/v1/consultations',
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
      // Валидируем
      const validation = consultationSchema.safeParse(request.body)
      if (!validation.success) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Ошибка валидации',
          { field: validation.error.issues[0]?.path[0] }
        )
      }

      const { name, phone, email, channel, message, skinType, concern, source } = validation.data
      const userId = request.user?.id

      // Транзакция: создаём заявку + два ConsentRecord
      try {
        await app.prisma.$transaction(async (tx) => {
          // Создаём заявку на консультацию
          const consultation = await tx.consultationRequest.create({
            data: {
              userId: userId || undefined,
              name,
              phone,
              email,
              channel,
              message,
              skinType,
              concern,
              source,
              consentVersion: `${CONSENT_TEXT_VERSION.consultation}+${CONSENT_TEXT_VERSION.health_data}`,
              consentedAt: new Date(),
            },
          })

          // Создаём согласие на обработку ПДн для консультации
          if (userId) {
            await tx.consentRecord.create({
              data: {
                userId,
                purpose: 'consultation',
                textVersion: CONSENT_TEXT_VERSION.consultation,
              },
            })

            // Создаём согласие на обработку данных о состоянии кожи
            await tx.consentRecord.create({
              data: {
                userId,
                purpose: 'health_data',
                textVersion: CONSENT_TEXT_VERSION.health_data,
              },
            })
          }

          // После транзакции: уведомляем менеджера и отправляем в Telegram
          setImmediate(() => {
            // Email уведомление (не блокируем ответ)
            if (proNotifyEmail) {
              try {
                const mailSender = createMailSender()
                const channelLabel = channel === 'phone' ? 'Телефон' : channel === 'telegram' ? 'Telegram' : 'WhatsApp'
                const message = `Новая заявка на консультацию

Канал: ${channelLabel}
Ссылка: /admin/consultations

Обработана: ${new Date().toISOString()}`

                mailSender.sendPlain(
                  proNotifyEmail,
                  'Новая заявка на консультацию',
                  message
                ).catch((err) => {
                  app.log.warn({ err }, 'Failed to send consultation notification email')
                })
              } catch (err) {
                app.log.warn({ err }, 'Failed to send consultation notification email')
              }
            }

            // Telegram уведомление (не блокируем ответ)
            app.telegram.onNewConsultation(consultation.id).catch((err) => {
              app.log.warn({ err, consultation_id: consultation.id }, 'Failed to send Telegram notification for consultation')
            })
          })
        })
      } catch (err) {
        throw err
      }

      reply.status(200).send({ ok: true })
    }
  )
}
