import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { validateTaxId } from '@ps/shared'
import { ApiError } from '../../lib/errors.js'
import { CONSENT_TEXT_VERSION } from '../../lib/consents.js'
import { sniffMime, stripJpegMetadata, hashBuffer, saveProDocument, deleteStoredFile } from '../../lib/pro-docs.js'
import { checkSelfEmployed } from '../../lib/fns-npd.js'
import { decide, isInnTakenError } from '../../lib/pro-decision.js'
import { proDocs, proNotifyEmail, dadataApiKey } from '../../lib/env.js'
import { maskInn } from '../../lib/masks.js'
import { lookupParty } from '../../lib/registry/dadata.js'
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
              proStatus: { type: 'string', enum: ['pending'] },
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
      let fileBuffer: Buffer | null = null

      for await (const part of parts) {
        if (part.type === 'field') {
          fields[part.fieldname] = part.value as string
        } else if (part.type === 'file') {
          if (part.fieldname !== 'document') {
            throw new ApiError(400, 'VALIDATION_ERROR', 'Неправильное имя поля файла')
          }
          if (fileBuffer) {
            throw new ApiError(400, 'VALIDATION_ERROR', 'Ровно один файл')
          }
          // Поток файла читаем сразу: busboy не отдаёт следующие части формы,
          // пока текущий файл не вычитан, и форма с файлом не в конце висела бы
          // до таймаута сокета.
          fileBuffer = await part.toBuffer()
        }
      }

      if (!fileBuffer) {
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

        // Проверяем в DaData по INN
        let registryHit = null
        const partyLookup = await lookupParty(inn, dadataApiKey)
        if (partyLookup.status === 'found' && partyLookup.name && partyLookup.state) {
          registryHit = {
            name: partyLookup.name,
            okvedMain: partyLookup.okvedMain || null,
            okveds: partyLookup.okveds || [],
            state: partyLookup.state,
          }
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
              proReviewedAt: null, // Менеджер установит при решении
              proDecisionSource: null, // Автомат не принимает решения
              proCheck: decision.check,
              proRejectReason: null,
            }

            // Отмечаем согласие на обработку ПДн, если это первый запрос
            if (!user?.acceptedTermsAt) {
              updateData.acceptedTermsAt = new Date()
            }

            // Гарантируем, что заявка подана ровно один раз: updateMany с условием
            // на статус. Если пользователь уже подал заявку (pending/approved),
            // count будет 0 и мы откатим транзакцию с 409.
            const updateResult = await tx.user.updateMany({
              where: {
                id: userId,
                proStatus: { in: ['none', 'rejected'] },
              },
              data: updateData,
            })

            if (updateResult.count === 0) {
              // Заявка уже подана или одобрена — не допускаем редактирование
              throw new ApiError(409, 'PRO_ALREADY_REQUESTED', 'Заявка уже подана')
            }

            // Срок хранения отсчитывается от решения менеджера (его ставит
            // админка), а не от подачи: иначе заявка, пролежавшая месяц,
            // потеряла бы скан раньше, чем её кто-то открыл.
            await tx.proDocument.create({
              data: {
                userId,
                storageKey,
                mime,
                sizeBytes: processedBuffer.length,
                sha256,
                deleteAfter: null,
                deletedAt: null,
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
          // Нарушение уникального индекса на INN для одобренного — выбросил выше
          // при updateMany count === 0, этот путь тех. страховка только
          if (isInnTakenError(err)) {
            if (storageKey) {
              await deleteStoredFile(proDocs, storageKey)
            }
            throw new ApiError(409, 'PRO_INN_TAKEN', 'Этот ИНН уже подан заявкой. Напишите нам')
          }
          throw err
        }

        // Отправляем уведомление менеджеру на каждую заявку
        // Зелёный lane (найдено в реестре) помечается в теме для приоритизации
        if (proNotifyEmail) {
          try {
            const mailSender = createMailSender()
            const laneMark = decision.lane === 'green' ? '✓ ' : ''
            const checkText = decision.check.registry
              ? `\nНайдено в реестре: ${decision.check.registry.name} (${decision.check.registry.okvedMain || 'н/а'}, статус: ${decision.check.registry.state})`
              : `\nВ реестре не найдено. НПД статус: ${decision.check.npd}`

            const message = `${laneMark}Новая заявка специалиста на проверку

Салон: ${companyName}
ИНН: ${maskInn(inn)}${checkText}
Ссылка: /admin/pro-requests

Обработана: ${decision.check.checkedAt.toISOString()}`

            await mailSender.sendPlain(
              proNotifyEmail,
              `${laneMark}Новая заявка специалиста на проверку`,
              message
            )
          } catch (err) {
            app.log.warn({ err, user_id: userId }, 'Failed to send pro request notification email')
          }
        }

        // Отправляем уведомление в Telegram (не блокирует ответ, ошибки → warn)
        app.telegram.onNewApplication(userId).catch((err) => {
          app.log.warn({ err, user_id: userId }, 'Failed to send Telegram notification for pro application')
        })

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
