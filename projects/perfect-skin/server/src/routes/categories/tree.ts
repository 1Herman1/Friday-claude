import type { FastifyInstance } from 'fastify'
import { ACTIVE } from '../../lib/prisma-filters.js'

interface CategoryWithChildren {
  id: string
  name: string
  slug: string
  image: string | null
  productCount: number
  children: CategoryWithChildren[]
}

async function countCategoryProducts(prisma: any, categoryId: string): Promise<number> {
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
      },
    },
  })

  return count
}

async function buildCategoryTree(prisma: any): Promise<CategoryWithChildren[]> {
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

    const productCount = await countCategoryProducts(prisma, cat.id)

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
      // Set cache header
      reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')

      const tree = await buildCategoryTree(app.prisma)
      return tree
    }
  )
}
