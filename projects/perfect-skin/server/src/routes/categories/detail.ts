import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ACTIVE } from '../../lib/prisma-filters.js'
import { ApiError } from '../../lib/errors.js'

const paramsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,64}$/),
})

async function countCategoryProducts(prisma: any, categoryId: string): Promise<number> {
  const getCategoryIds = async (id: string): Promise<string[]> => {
    const ids = [id]
    const children = await prisma.category.findMany({
      where: { parentId: id, ...ACTIVE },
      select: { id: true },
    })
    for (const child of children) {
      ids.push(...(await getCategoryIds(child.id)))
    }
    return ids
  }

  const categoryIds = await getCategoryIds(categoryId)

  const count = await prisma.productCategory.count({
    where: {
      categoryId: { in: categoryIds },
      product: {
        ...ACTIVE,
        variants: { some: ACTIVE },
      },
    },
  })

  return count
}

export default async function detailRoute(app: FastifyInstance) {
  app.get(
    '/:slug',
    {
      schema: {
        response: {
          200: { $ref: 'ps.categoryDetail#' },
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

      // Set cache header
      reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')

      const category = await app.prisma.category.findFirst({
        where: { slug, ...ACTIVE },
        include: { parent: true },
      })

      if (!category) {
        throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Категория не найдена')
      }

      const productCount = await countCategoryProducts(app.prisma, category.id)

      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        productCount,
        parent: category.parent
          ? { name: category.parent.name, slug: category.parent.slug }
          : null,
        seo: {
          title: category.seoTitle,
          description: category.seoDescription,
        },
      }
    }
  )
}
