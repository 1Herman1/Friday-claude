import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getFacets } from '../../services/catalog.service.js'
import { ApiError } from '../../lib/errors.js'

const querySchema = z.object({
  category: z.string().regex(/^[a-z0-9-]{1,64}$/).optional(),
  brand: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (Array.isArray(v) ? v : v ? [v] : undefined)),
  line: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (Array.isArray(v) ? v : v ? [v] : undefined)),
  need: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (Array.isArray(v) ? v : v ? [v] : undefined)),
  skin: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (Array.isArray(v) ? v : v ? [v] : undefined)),
  minPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
  // Reject sort, limit, offset
  sort: z.undefined().optional(),
  limit: z.undefined().optional(),
  offset: z.undefined().optional(),
})

export default async function facetsRoute(app: FastifyInstance) {
  app.get(
    '/facets',
    {
      schema: {
        response: {
          200: { $ref: 'ps.facets#' },
          400: { $ref: 'ps.error#' },
          429: { $ref: 'ps.error#' },
          500: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      // Check for rejected params
      const query = request.query as any
      if (query.sort !== undefined || query.limit !== undefined || query.offset !== undefined) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Параметры sort, limit, offset не допускаются в facets',
          { field: 'sort' }
        )
      }

      const parsed = querySchema.safeParse(query)
      if (!parsed.success) {
        const field = parsed.error.issues[0]?.path[0]
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации', { field })
      }

      const q = parsed.data

      // Validate price range
      if (q.minPrice !== undefined && q.maxPrice !== undefined && q.minPrice > q.maxPrice) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации', { field: 'maxPrice' })
      }

      // Validate concern values
      if (q.need) {
        const validNeeds = [
          'hydration',
          'firming',
          'regeneration',
          'radiance',
          'pigmentation',
          'sebum_control',
          'cleansing',
          'hygiene',
          'sensitivity',
          'barrier',
          'daily_care',
          'express_care',
          'intensive_care',
          'nourishing',
          'anti_age',
          'acne',
          'redness',
          'sun_protection',
          'eye_area',
          'post_procedure',
        ]
        for (const need of q.need) {
          if (!validNeeds.includes(need)) {
            throw new ApiError(400, 'VALIDATION_ERROR', 'Неизвестное значение need', {
              field: 'need',
            })
          }
        }
      }

      // Validate skin type values
      if (q.skin) {
        const validSkins = ['normal', 'dry', 'oily', 'combination', 'sensitive', 'mature']
        for (const skin of q.skin) {
          if (!validSkins.includes(skin)) {
            throw new ApiError(400, 'VALIDATION_ERROR', 'Неизвестное значение skin', {
              field: 'skin',
            })
          }
        }
      }

      // Set cache header
      reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')

      const result = await getFacets(app.prisma, {
        category: q.category,
        brand: q.brand,
        line: q.line,
        need: q.need,
        skin: q.skin,
        minPrice: q.minPrice,
        maxPrice: q.maxPrice,
      })

      return result
    }
  )
}
