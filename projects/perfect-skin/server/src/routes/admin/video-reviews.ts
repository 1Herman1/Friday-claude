import { createReadStream } from 'node:fs'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  CONSENT_DOC_LIMIT_BYTES,
  MEDIA_LIMIT_BYTES,
  MEDIA_SLOTS,
  createVideoReview,
  deleteVideoMedia,
  deleteVideoReview,
  getAdminVideoReview,
  listAdminVideoReviews,
  readConsentDoc,
  reorderVideoReviews,
  updateVideoReview,
  uploadConsentDoc,
  uploadVideoMedia,
  type MediaSlot,
} from '../../services/video-review.service.js'
import { ApiError } from '../../lib/errors.js'

type PreHandlers = Array<(request: FastifyRequest, reply: FastifyReply) => Promise<void>>

const consentExpiry = z
  .union([
    z.string().datetime({ offset: true }),
    // Дата без времени — начало этого дня по Москве: срок истекает раньше, это безопаснее для согласия.
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((day) => `${day}T00:00:00+03:00`),
  ])
  .transform((value) => new Date(value))
  .refine((date) => !Number.isNaN(date.getTime()), 'Некорректная дата')

const createSchema = z
  .object({
    authorName: z.string().min(1).max(60),
    caption: z.string().max(140).nullable().optional(),
    productId: z.string().uuid().nullable().optional(),
    consentNote: z.string().max(300).nullable().optional(),
    consentTemplateVersion: z.string().max(40).nullable().optional(),
  })
  .strict()

const patchSchema = z
  .object({
    authorName: z.string().min(1).max(60).optional(),
    caption: z.string().max(140).nullable().optional(),
    productId: z.string().uuid().nullable().optional(),
    consentNote: z.string().max(300).nullable().optional(),
    consentTemplateVersion: z.string().max(40).nullable().optional(),
    consentAllowSite: z.boolean().optional(),
    consentAllowSocial: z.boolean().optional(),
    consentAllowAds: z.boolean().optional(),
    consentExpiresAt: consentExpiry.nullable().optional(),
    consentConfirmed: z.boolean().optional(),
    contentReviewed: z.boolean().optional(),
    consentRevoked: z.literal(true).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()

const reorderSchema = z
  .object({
    ids: z
      .array(z.string().uuid())
      .min(1)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length, 'Идентификаторы повторяются'),
  })
  .strict()

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const

const mediaParams = {
  type: 'object',
  required: ['id', 'slot'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    slot: { type: 'string', enum: [...MEDIA_SLOTS] },
  },
} as const

const errorResponses = {
  400: { $ref: 'ps.error#' },
  401: { $ref: 'ps.error#' },
  403: { $ref: 'ps.error#' },
  404: { $ref: 'ps.error#' },
  409: { $ref: 'ps.error#' },
} as const

function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
  }
  return result.data
}

export async function videoReviewsRoutes(app: FastifyInstance, preHandlers: PreHandlers) {
  // GET /api/v1/admin/video-reviews - все неудалённые отзывы
  app.get(
    '/video-reviews',
    {
      preHandler: preHandlers,
      schema: {
        response: {
          200: { $ref: 'ps.adminVideoReviewList#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (_request, reply) => {
      const items = await listAdminVideoReviews()
      reply.code(200)
      return { items }
    }
  )

  app.get<{ Params: { id: string } }>(
    '/video-reviews/:id',
    {
      preHandler: preHandlers,
      schema: {
        params: idParams,
        response: { 200: { $ref: 'ps.adminVideoReview#' }, ...errorResponses },
      },
    },
    async (request, reply) => {
      const review = await getAdminVideoReview(request.params.id)
      reply.code(200)
      return review
    }
  )

  app.post<{ Body: unknown }>(
    '/video-reviews',
    {
      preHandler: preHandlers,
      schema: {
        response: { 201: { $ref: 'ps.adminVideoReview#' }, ...errorResponses },
      },
    },
    async (request, reply) => {
      const review = await createVideoReview(parseBody(createSchema, request.body))
      reply.code(201)
      return review
    }
  )

  // PUT до PATCH-маршрута с :id — иначе «order» читался бы как идентификатор.
  app.put<{ Body: unknown }>(
    '/video-reviews/order',
    {
      preHandler: preHandlers,
      schema: {
        response: { 204: { type: 'null' }, ...errorResponses },
      },
    },
    async (request, reply) => {
      const { ids } = parseBody(reorderSchema, request.body)
      await reorderVideoReviews(ids)
      reply.code(204)
      return null
    }
  )

  app.patch<{ Params: { id: string }; Body: unknown }>(
    '/video-reviews/:id',
    {
      preHandler: preHandlers,
      schema: {
        params: idParams,
        response: { 200: { $ref: 'ps.adminVideoReview#' }, ...errorResponses },
      },
    },
    async (request, reply) => {
      const patch = parseBody(patchSchema, request.body)
      const review = await updateVideoReview(request.params.id, patch, request.user!.id, request.log)
      reply.code(200)
      return review
    }
  )

  app.delete<{ Params: { id: string } }>(
    '/video-reviews/:id',
    {
      preHandler: preHandlers,
      schema: {
        params: idParams,
        response: { 204: { type: 'null' }, ...errorResponses },
      },
    },
    async (request, reply) => {
      await deleteVideoReview(request.params.id, request.log)
      reply.code(204)
      return null
    }
  )

  app.post<{ Params: { id: string; slot: MediaSlot } }>(
    '/video-reviews/:id/media/:slot',
    {
      preHandler: preHandlers,
      config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
      schema: {
        params: mediaParams,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['slot', 'url', 'warnings'],
            properties: {
              slot: { type: 'string', enum: [...MEDIA_SLOTS] },
              url: { type: 'string' },
              warnings: { type: 'array', items: { type: 'string' } },
            },
          },
          ...errorResponses,
          413: { $ref: 'ps.error#' },
          422: { $ref: 'ps.error#' },
          500: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      const { id, slot } = request.params
      const file = await request.file({ limits: { fileSize: MEDIA_LIMIT_BYTES[slot], files: 1 } })
      if (!file) {
        throw new ApiError(400, 'NO_FILE', 'Файл не загружен')
      }
      const result = await uploadVideoMedia(id, slot, file, request.log)
      reply.code(200)
      return result
    }
  )

  app.delete<{ Params: { id: string; slot: MediaSlot } }>(
    '/video-reviews/:id/media/:slot',
    {
      preHandler: preHandlers,
      schema: {
        params: mediaParams,
        response: { 204: { type: 'null' }, ...errorResponses },
      },
    },
    async (request, reply) => {
      await deleteVideoMedia(request.params.id, request.params.slot, request.log)
      reply.code(204)
      return null
    }
  )

  app.post<{ Params: { id: string } }>(
    '/video-reviews/:id/consent-doc',
    {
      preHandler: preHandlers,
      schema: {
        params: idParams,
        response: { 200: { $ref: 'ps.adminVideoReview#' }, ...errorResponses, 413: { $ref: 'ps.error#' } },
      },
    },
    async (request, reply) => {
      const file = await request.file({ limits: { fileSize: CONSENT_DOC_LIMIT_BYTES, files: 1 } })
      if (!file) {
        throw new ApiError(400, 'NO_FILE', 'Файл не загружен')
      }
      const review = await uploadConsentDoc(request.params.id, file)
      reply.code(200)
      return review
    }
  )

  // Документ отдаём только как вложение и не кэшируем: это персональные данные.
  app.get<{ Params: { id: string } }>(
    '/video-reviews/:id/consent-doc',
    {
      preHandler: preHandlers,
      schema: {
        params: idParams,
        response: errorResponses,
      },
    },
    async (request, reply) => {
      const doc = await readConsentDoc(request.params.id)
      reply.type(doc.mime)
      reply.header('Content-Disposition', `attachment; filename="${doc.filename}"`)
      reply.header('Cache-Control', 'no-store')
      return reply.send(createReadStream(doc.path))
    }
  )
}
