import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { MultipartFile } from '@fastify/multipart'
import { z } from 'zod'
import { validateTaxId } from '@ps/shared'
import { ApiError } from '../../lib/errors.js'
import { CONSENT_TEXT_VERSION } from '../../lib/consents.js'
import { sniffMime, stripJpegMetadata, hashBuffer, saveProDocument, deleteStoredFile } from '../../lib/pro-docs.js'
import { checkSelfEmployed } from '../../lib/fns-npd.js'
import { decide, isInnTakenError } from '../../lib/pro-decision.js'
import { proDocs, proNotifyEmail } from '../../lib/env.js'
import { maskInn } from '../../lib/masks.js'
import { createMailSender } from '../../services/mail/index.js'

const applySchema = z.object({
  companyName: z.string().min(2).max(120),
  inn: z.string().regex(/^\d{10,12}$/, 'ИНН должен быть 10 или 12 цифр'),
  ogrnip: z
    .string()
    .optional()
    .refine(
      (value) => {
        if (!value) return true // опционально
        return /^\d{13,15}$/.test(value) // 13 (ОГРН) или 15 (ОГРНИП) цифр
      },
      'ОГРНИП/ОГРН должен быть 13 или 15 цифр'
    ),
  specialization: z.string().min(2).max(120),
  comment: z.string().max(500).optional(),
  consentPd: z.enum(['true'], {
    errorMap: () => ({ message: 'Согласие на обработку ПДн обязательно' }),
  }),
  consentMarketing: z.enum(['true', 'false']).optional(),
})

export default async function proRoute(app: FastifyInstance) {
  // POST /api/v1/pro/apply — multipart upload с документом
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
            required: ['proStatus', 'lane'],
            properties: {
              proStatus: { type: 'string', enum: ['pending', 'approved'] },
              lane: { type: 'string', enum: ['green', 'yellow'] },
            },
          },
          400: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticate,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id

      // Проверяем состояние пользователя
      const user = await app.prisma.user.findUnique({
        where: { id: userId },
        select: { proStatus: true, acceptedTermsAt: true },
      })

      if (user?.proStatus === 'pending') {
        throw new ApiError(409, 'PRO_ALREADY_REQUESTED', 'Заявка уже подана')
      }

      if (user?.proStatus === 'approved') {
        throw new ApiError(409, 'PRO_ALREADY_APPROVED', 'Ваш статус специалиста уже подтвержден')
      }

      // Парсим multipart данные
      const parts = request.parts()
      const fields: Record<string, string> = {}
      let documentPart: MultipartFile | null = null

      for await (const part of parts) {
        if (part.type === 'field') {
          fields[part.fieldname] = part.value as string
        } else if (part.type === 'file') {
          if (part.fieldname !== 'document') {
            throw new ApiError(400, 'VALIDATION_ERROR', 'Неправильное имя поля файла')
          }
          if (documentPart) {
            throw new ApiError(400, 'VALIDATION_ERROR', 'Ровно один файл')
          }
          documentPart = part
        }
      }

      if (!documentPart) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Файл документа обязателен')
      }

      // Валидируем поля
      const fieldValidation = applySchema.safeParse(fields)
      if (!fieldValidation.success) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Ошибка валидации',
          { field: fieldValidation.error.issues[0]?.path[0] }
        )
      }

      const { companyName, inn, ogrnip, specialization, comment, consentPd, consentMarketing } = fieldValidation.data

      // Дополнительно валидируем inn через validateTaxId
      const innValidation = validateTaxId(inn)
      if (!innValidation.ok) {
        throw new ApiError(400, 'VALIDATION_ERROR', innValidation.reason)
      }

      // Читаем файл в память
      const fileBuffer = await documentPart.toBuffer()

      let storageKey: string | null = null
      try {
        // Определяем MIME-тип по сигнатуре
        const mime = sniffMime(fileBuffer)

        // Для JPEG убираем EXIF/XMP и IPTC
        let processedBuffer = fileBuffer
        if (mime === 'image/jpeg') {
          processedBuffer = stripJpegMetadata(fileBuffer)
        }

        // Вычисляем SHA256
        const sha256 = hashBuffer(processedBuffer)

        // Сохраняем файл
        storageKey = await saveProDocument(proDocs, processedBuffer, mime)

        // Ищем в реестре МСП
        let registryHit = await app.prisma.registryProfile.findUnique({
          where: { inn },
          select: { name: true, okvedMain: true, releaseDate: true },
        })

        // Если не найден по INN, пробуем по ОГРНИП
        if (!registryHit && ogrnip) {
          registryHit = await app.prisma.registryProfile.findUnique({
            where: { ogrn: ogrnip },
            select: { name: true, okvedMain: true, releaseDate: true },
          })
        }

        // Проверяем ИП в НПД, если INN 12-значный и не найден в реестре
        let npd: 'self_employed' | 'not_self_employed' | 'unavailable' | 'not_checked' = 'not_checked'
        if (!registryHit && inn.length === 12) {
          npd = await checkSelfEmployed(inn)
        }

        // Принимаем решение
        const decision = decide({
          registryHit,
          npd: npd === 'not_checked' ? 'unavailable' : npd,
        })

        // Транзакция: обновляем пользователя, создаём документ, создаём согласия
        try {
          await app.prisma.$transaction(async (tx) => {
            const updateData: any = {
              proStatus: decision.status,
              companyName,
              inn,
              ogrnip: ogrnip || null,
              specialization,
              proRequestedAt: new Date(),
              proReviewedAt: decision.status === 'approved' ? new Date() : null,
              proDecisionSource: decision.source,
              proCheck: decision.check,
              proRejectReason: null,
            }

            // При одобрении выставляем роль professional
            if (decision.status === 'approved') {
              updateData.role = 'professional'
            }

            // Отмечаем согласие на обработку ПДн, если это первый запрос
            if (!user?.acceptedTermsAt) {
              updateData.acceptedTermsAt = new Date()
            }

            await tx.user.update({
              where: { id: userId },
              data: updateData,
            })

            // Создаём документ
            const now = new Date()
            const deleteAfter = decision.status === 'approved' ? now : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // +30 дней при pending
            const deletedAt = decision.status === 'approved' ? now : null

            await tx.proDocument.create({
              data: {
                userId,
                storageKey: decision.status === 'approved' ? null : storageKey, // file будет удалён сразу
                mime,
                sizeBytes: processedBuffer.length,
                sha256,
                deleteAfter,
                deletedAt,
              },
            })

            // Создаём согласие на ПДн
            await tx.consentRecord.create({
              data: {
                userId,
                purpose: 'pro_application',
                textVersion: CONSENT_TEXT_VERSION.pro_application,
              },
            })

            // Создаём согласие на рассылку, если дал
            if (consentMarketing === 'true') {
              await tx.consentRecord.create({
                data: {
                  userId,
                  purpose: 'marketing',
                  textVersion: CONSENT_TEXT_VERSION.marketing,
                },
              })
            }
          })
        } catch (err) {
          // Нарушение уникального индекса на INN для approved статуса
          if (isInnTakenError(err)) {
            if (storageKey) {
              await deleteStoredFile(proDocs, storageKey)
            }
            throw new ApiError(409, 'PRO_INN_TAKEN', 'Этот ИНН уже подтверждён для другого аккаунта. Напишите нам')
          }
          throw err
        }

        // После успешного коммита: если одобрено, удаляем файл
        if (decision.status === 'approved' && storageKey) {
          try {
            await deleteStoredFile(proDocs, storageKey)
            // Обновляем storageKey в БД
            await app.prisma.proDocument.updateMany({
              where: { userId, storageKey },
              data: { storageKey: null, deletedAt: new Date() },
            })
          } catch (err) {
            // Файл удалится при purge, не валим ответ
            app.log.warn({ err }, `Failed to delete pro document immediately for user ${userId}`)
          }
        }

        // Если pending, отправляем уведомление менеджеру
        if (decision.status === 'pending' && proNotifyEmail) {
          try {
            const mailSender = createMailSender()
            const checkText = decision.check.registry
              ? `\nНайдено в реестре МСП: ${decision.check.registry.name} (${decision.check.registry.okvedMain || 'н/а'})`
              : `\nВ реестре МСП не найдено. НПД статус: ${decision.check.npd}`

            const message = `Новая заявка специалиста на проверку

Салон: ${companyName}
ИНН: ${maskInn(inn)}${checkText}
Ссылка: /admin/pro-requests

Обработана: ${decision.check.checkedAt.toISOString()}`

            await mailSender.sendPlain(
              proNotifyEmail,
              'Новая заявка специалиста на проверку',
              message
            )
          } catch (err) {
            app.log.warn({ err, user_id: userId }, 'Failed to send pro request notification email')
          }
        }

        reply.status(200).send({
          proStatus: decision.status,
          lane: decision.lane,
        })
      } catch (err) {
        // При ошибке удаляем сохранённый файл
        if (storageKey) {
          try {
            await deleteStoredFile(proDocs, storageKey)
          } catch (cleanupErr) {
            app.log.error({ cleanupErr, storageKey }, 'Failed to cleanup pro document file')
          }
        }
        throw err
      }
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
