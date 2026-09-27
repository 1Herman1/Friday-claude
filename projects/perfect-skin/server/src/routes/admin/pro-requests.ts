import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { ApiError } from '../../lib/errors.js'
import { createMailSender } from '../../services/mail/index.js'
import { proDocs } from '../../lib/env.js'
import { readStoredFile } from '../../lib/pro-docs.js'
import { reviewApplication } from '../../services/pro-review.service.js'

const listQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).optional().default('pending'),
  skip: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

const patchSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
  expectedRequestedAt: z.string().datetime().optional(),
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
                  required: ['id', 'name', 'email', 'phone', 'companyName', 'inn', 'ogrnip', 'specialization', 'proStatus', 'proDecisionSource', 'proCheck', 'proRequestedAt', 'proReviewedAt', 'proRejectReason', 'document', 'innDuplicates'],
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    email: { type: ['string', 'null'] },
                    phone: { type: ['string', 'null'] },
                    companyName: { type: 'string' },
                    inn: { type: 'string' },
                    ogrnip: { type: ['string', 'null'] },
                    specialization: { type: 'string' },
                    proStatus: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
                    proDecisionSource: { type: ['string', 'null'], enum: ['auto_msp', 'manual'] },
                    proCheck: { type: ['object', 'null'] },
                    proRequestedAt: { type: 'string', format: 'date-time' },
                    proReviewedAt: { type: ['string', 'null'], format: 'date-time' },
                    proRejectReason: { type: ['string', 'null'] },
                    document: {
                      type: ['object', 'null'],
                      properties: {
                        mime: { type: 'string' },
                        sizeBytes: { type: 'integer' },
                        uploadedAt: { type: 'string', format: 'date-time' },
                        available: { type: 'boolean' },
                      },
                    },
                    innDuplicates: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['pending', 'approved'],
                      properties: {
                        pending: { type: 'integer' },
                        approved: { type: 'integer' },
                      },
                    },
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
            ogrnip: true,
            specialization: true,
            proStatus: true,
            proDecisionSource: true,
            proCheck: true,
            proRequestedAt: true,
            proReviewedAt: true,
            proRejectReason: true,
            proDocuments: {
              select: {
                mime: true,
                sizeBytes: true,
                uploadedAt: true,
                storageKey: true,
              },
              orderBy: { uploadedAt: 'desc' },
              take: 1,
            },
          },
          orderBy: { proRequestedAt: 'desc' },
          skip,
          take: limit,
        }),
        app.prisma.user.count({ where }),
      ])

      // Получаем все ИННы с этой страницы и считаем дубликаты одним запросом
      const inns = items.map(u => u.inn).filter((inn): inn is string => !!inn)
      let innDuplicatesMap: Map<string, { pending: number; approved: number }> = new Map()

      if (inns.length > 0) {
        // Дальше для каждого ИНН считаем по отдельности pending и approved
        for (const inn of inns) {
          const pending = await app.prisma.user.count({
            where: {
              inn,
              deletedAt: null,
              proStatus: 'pending',
            },
          })
          const approved = await app.prisma.user.count({
            where: {
              inn,
              deletedAt: null,
              proStatus: 'approved',
            },
          })
          innDuplicatesMap.set(inn, { pending, approved })
        }
      }

      const formattedItems = items.map((u) => {
        const latestDoc = u.proDocuments[0]
        const innDuplicates = innDuplicatesMap.get(u.inn || '') || { pending: 0, approved: 0 }
        return {
          id: u.id,
          name: u.name,
          email: u.email || null,
          phone: u.phone || null,
          companyName: u.companyName || '',
          inn: u.inn || '',
          ogrnip: u.ogrnip || null,
          specialization: u.specialization || '',
          proStatus: u.proStatus,
          proDecisionSource: u.proDecisionSource || null,
          proCheck: u.proCheck || null,
          proRequestedAt: u.proRequestedAt?.toISOString() || '',
          proReviewedAt: u.proReviewedAt ? u.proReviewedAt.toISOString() : null,
          proRejectReason: u.proRejectReason || null,
          document: latestDoc
            ? {
                mime: latestDoc.mime,
                sizeBytes: latestDoc.sizeBytes,
                uploadedAt: latestDoc.uploadedAt.toISOString(),
                available: !!latestDoc.storageKey,
              }
            : null,
          innDuplicates,
        }
      })

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

      const { action, reason, expectedRequestedAt } = result.data

      // Используем сервис для общей логики
      const mailSender = createMailSender()
      const updatedUser = await reviewApplication(app.prisma, {
        applicantId: id,
        action,
        reason,
        expectedRequestedAt,
        reviewerId: request.user!.id,
        via: 'admin',
      }, mailSender, app.telegram)

      reply.status(200).send(updatedUser)
    }
  )

  // GET /api/v1/admin/pro-requests/:userId/document
  app.get(
    '/pro-requests/:userId/document',
    {
      preHandler: preHandlers,
      schema: {
        response: {
          200: {
            type: 'string',
            format: 'binary',
          },
          400: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string }

      // Валидируем userId как UUID
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Неверный формат userId')
      }

      // Получаем последний документ пользователя с файлом
      const doc = await app.prisma.proDocument.findFirst({
        where: {
          userId,
          storageKey: { not: null },
        },
        orderBy: { uploadedAt: 'desc' },
      })

      if (!doc || !doc.storageKey) {
        throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Документ удалён по сроку хранения или не загружался')
      }

      // Читаем файл
      const fileBuffer = await readStoredFile(proDocs, doc.storageKey)

      // Устанавливаем заголовки
      reply.header('Content-Type', doc.mime)
      reply.header('Cache-Control', 'no-store')
      reply.header('X-Content-Type-Options', 'nosniff')

      // Для PDF — attachment (скачать), для картинок — inline (просмотр)
      const disposition = doc.mime === 'application/pdf' ? 'attachment' : 'inline'
      reply.header('Content-Disposition', `${disposition}; filename="document"`)

      // CSP для безопасности: запрещаем JS в PDF
      reply.header('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox")

      reply.type(doc.mime).send(fileBuffer)
    }
  )
}
