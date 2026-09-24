import type { FastifyInstance } from 'fastify'
import { ACTIVE, productVisibleFor } from '../../lib/prisma-filters.js'
import { viewerFromRequest } from '../../lib/pricing.js'

export default async function listRoute(app: FastifyInstance) {
  app.get(
    '/',
    {
      // Счётчики и состав зависят от того, кто смотрит: без этого одобренный
      // специалист получал бы гостевые цифры и не видел своих категорий.
      preHandler: app.authenticateOptional,
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
      // Set cache header (private because response depends on viewer)
      reply.header('Cache-Control', 'private, max-age=60')

      const viewer = viewerFromRequest(request)
      const viewerFilter = productVisibleFor(viewer)

      // Get all brands that have active visible products
      const brands = await app.prisma.brand.findMany({
        where: {
          ...ACTIVE,
          products: {
            some: {
              ...ACTIVE,
              variants: { some: ACTIVE },
              ...viewerFilter,
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
              ...viewerFilter,
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
