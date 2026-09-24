import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ACTIVE, productVisibleFor } from '../../lib/prisma-filters.js'
import { viewerFromRequest } from '../../lib/pricing.js'
import { ApiError } from '../../lib/errors.js'

const paramsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,64}$/),
})

export default async function detailRoute(app: FastifyInstance) {
  app.get(
    '/:slug',
    {
      // Счётчики и состав зависят от того, кто смотрит: без этого одобренный
      // специалист получал бы гостевые цифры и не видел своих категорий.
      preHandler: app.authenticateOptional,
      schema: {
        response: {
          200: { $ref: 'ps.brandDetail#' },
          400: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
          500: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      const parsed = paramsSchema.safeParse(request.params)
      if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации', { field: 'slug' })
      }

      const { slug } = parsed.data

      // Set cache header (private because response depends on viewer)
      reply.header('Cache-Control', 'private, max-age=60')

      const viewer = viewerFromRequest(request)
      const viewerFilter = productVisibleFor(viewer)

      const brand = await app.prisma.brand.findFirst({
        where: { slug, ...ACTIVE },
      })

      if (!brand) {
        throw new ApiError(404, 'BRAND_NOT_FOUND', 'Бренд не найден')
      }

      // Count products
      const productCount = await app.prisma.product.count({
        where: {
          brandId: brand.id,
          ...ACTIVE,
          variants: { some: ACTIVE },
          ...viewerFilter,
        },
      })

      // Get lines for this brand
      const lines = await app.prisma.productLine.findMany({
        where: {
          brandId: brand.id,
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

      // Count products in each line
      const linesData = await Promise.all(
        lines.map(async (line) => {
          const lineProductCount = await app.prisma.product.count({
            where: {
              lineId: line.id,
              ...ACTIVE,
              variants: { some: ACTIVE },
              ...viewerFilter,
            },
          })

          return {
            id: line.id,
            name: line.name,
            slug: line.slug,
            productCount: lineProductCount,
          }
        })
      )

      return {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        logo: brand.logo,
        description: brand.description,
        country: brand.country,
        manufacturer: brand.manufacturer,
        productCount,
        lines: linesData,
        seo: {
          title: brand.seoTitle,
          description: brand.seoDescription,
        },
      }
    }
  )
}
