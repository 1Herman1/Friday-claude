import type { FastifyInstance } from 'fastify'
import { ACTIVE } from '../../lib/prisma-filters.js'

export default async function listRoute(app: FastifyInstance) {
  app.get(
    '/',
    {
      schema: {
        response: {
          200: {
            type: 'array',
            items: { $ref: 'ps.brand#' },
          },
          500: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      // Set cache header
      reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')

      // Get all brands that have active products
      const brands = await app.prisma.brand.findMany({
        where: {
          ...ACTIVE,
          products: {
            some: {
              ...ACTIVE,
              variants: { some: ACTIVE },
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })

      // Count products for each brand
      const result = await Promise.all(
        brands.map(async (brand) => {
          const productCount = await app.prisma.product.count({
            where: {
              brandId: brand.id,
              ...ACTIVE,
              variants: { some: ACTIVE },
            },
          })

          return {
            id: brand.id,
            name: brand.name,
            slug: brand.slug,
            logo: brand.logo,
            productCount,
          }
        })
      )

      return result
    }
  )
}
