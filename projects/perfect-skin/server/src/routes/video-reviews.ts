import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { listPublicVideoReviews } from '../services/video-review.service.js'
import { ApiError } from '../lib/errors.js'

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional().default(12),
})

export default async function videoReviewsRoutes(app: FastifyInstance) {
  // GET /api/v1/video-reviews - опубликованные видеоотзывы, без полей согласия
  app.get(
    '/video-reviews',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 20 },
          },
        },
        response: {
          200: { $ref: 'ps.videoReviewList#' },
          400: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      const result = listSchema.safeParse(request.query)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const items = await listPublicVideoReviews(result.data.limit)

      reply.header('Cache-Control', 'public, max-age=60')
      reply.code(200)
      return { items }
    }
  )
}
