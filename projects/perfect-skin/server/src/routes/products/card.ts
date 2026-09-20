import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getProductBySlug } from '../../services/catalog.service.js'
import { ApiError } from '../../lib/errors.js'

const paramsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
})

export default async function cardRoute(app: FastifyInstance) {
  app.get(
    '/:slug',
    {
      schema: {
        response: {
          200: { $ref: 'ps.productCardFull#' },
          400: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
          500: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      try {
        const parsed = paramsSchema.safeParse(request.params)
        if (!parsed.success) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации', { field: 'slug' })
        }

        const { slug } = parsed.data

        // Set cache header
        reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')

        const product = await getProductBySlug(app.prisma, slug)

        if (!product) {
          throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Товар не найден')
        }

        return product
      } catch (error) {
        if (error instanceof ApiError) {
          throw error
        }
        console.error('Error in card route:', error)
        throw error
      }
    }
  )
}
