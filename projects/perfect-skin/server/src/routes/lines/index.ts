import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ACTIVE } from '../../lib/prisma-filters.js'
import { ApiError } from '../../lib/errors.js'

const querySchema = z.object({
  brand: z.string().regex(/^[a-z0-9-]{1,64}$/).optional(),
})

export default async function linesRoute(app: FastifyInstance) {
  app.get(
    '/',
    {
      schema: {
        response: {
          200: {
            type: 'array',
            items: { $ref: 'ps.line#' },
          },
          400: { $ref: 'ps.error#' },
          500: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      const parsed = querySchema.safeParse(request.query)
      if (!parsed.success) {
        const field = parsed.error.issues[0]?.path[0]
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации', { field })
      }

      const q = parsed.data

      // Set cache header
      reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')

      // Build where clause
      const where: any = {
        ...ACTIVE,
        products: {
          some: {
            ...ACTIVE,
            variants: { some: ACTIVE },
          },
        },
      }

      // Filter by brand if specified
      if (q.brand) {
        const brand = await app.prisma.brand.findFirst({
          where: { slug: q.brand, ...ACTIVE },
          select: { id: true },
        })

        if (!brand) {
          return [] // No lines for non-existent brand
        }

        where.brandId = brand.id
      }

      // Get lines with their brands
      const lines = await app.prisma.productLine.findMany({
        where,
        include: { brand: true },
        orderBy:
          q.brand !== undefined
            ? [{ sortOrder: 'asc' }, { name: 'asc' }]
            : [
                { brand: { sortOrder: 'asc' } },
                { sortOrder: 'asc' },
                { name: 'asc' },
              ],
      })

      // Count products for each line
      const result = await Promise.all(
        lines.map(async (line) => {
          const productCount = await app.prisma.product.count({
            where: {
              lineId: line.id,
              ...ACTIVE,
              variants: { some: ACTIVE },
            },
          })

          return {
            id: line.id,
            name: line.name,
            slug: line.slug,
            brand: {
              name: line.brand.name,
              slug: line.brand.slug,
            },
            productCount,
          }
        })
      )

      return result
    }
  )
}
