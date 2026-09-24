import type { FastifyInstance } from 'fastify'
import { ACTIVE, productVisibleFor } from '../../lib/prisma-filters.js'
import { viewerFromRequest } from '../../lib/pricing.js'

interface CategoryWithChildren {
  id: string
  name: string
  slug: string
  image: string | null
  productCount: number
  children: CategoryWithChildren[]
}

async function countCategoryProducts(prisma: any, categoryId: string, viewerFilter: any = {}): Promise<number> {
  // Count products in this category and all descendants
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
        ...viewerFilter,
      },
    },
  })

  return count
}

async function buildCategoryTree(prisma: any, viewerFilter: any = {}): Promise<CategoryWithChildren[]> {
  // Get all root categories
  const roots = await prisma.category.findMany({
    where: { parentId: null, ...ACTIVE },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  const buildNode = async (cat: any): Promise<CategoryWithChildren> => {
    const children = await prisma.category.findMany({
      where: { parentId: cat.id, ...ACTIVE },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    const productCount = await countCategoryProducts(prisma, cat.id, viewerFilter)

    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      image: cat.image,
      productCount,
      children: await Promise.all(children.map(buildNode)),
    }
  }

  // Filter out empty categories
  const tree = await Promise.all(roots.map(buildNode))
  return tree.filter((node) => node.productCount > 0)
}

export default async function treeRoute(app: FastifyInstance) {
  app.get(
    '/tree',
    {
      // Счётчики и состав зависят от того, кто смотрит: без этого одобренный
      // специалист получал бы гостевые цифры и не видел своих категорий.
      preHandler: app.authenticateOptional,
      schema: {
        response: {
          200: {
            type: 'array',
            items: { $ref: 'ps.category#' },
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
      const tree = await buildCategoryTree(app.prisma, viewerFilter)
      return tree
    }
  )
}
