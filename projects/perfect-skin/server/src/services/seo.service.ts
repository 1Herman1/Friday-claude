import type { PrismaClient } from '../lib/db.js'
import { ACTIVE, productVisibleFor } from '../lib/prisma-filters.js'
import { TtlCache } from '../lib/ttl-cache.js'

const NAV_CACHE_TTL_MS = 60_000
const navCache = new TtlCache<CategoryNode[]>(NAV_CACHE_TTL_MS, 1)
const NAV_KEY = 'nav'

export interface CategoryNode {
  id: string
  name: string
  slug: string
  description: string | null
  seoTitle: string | null
  seoDescription: string | null
  parentId: string | null
  productCount: number
  updatedAt: Date
}

export function countCategoryProducts(
  categories: { id: string; parentId: string | null }[],
  links: { categoryId: string; productId: string }[],
): Map<string, number> {
  const childrenOf = new Map<string, string[]>()
  for (const category of categories) {
    if (category.parentId) childrenOf.set(category.parentId, [...(childrenOf.get(category.parentId) ?? []), category.id])
  }
  const productsOf = new Map<string, Set<string>>()
  for (const link of links) {
    productsOf.set(link.categoryId, (productsOf.get(link.categoryId) ?? new Set<string>()).add(link.productId))
  }

  const counts = new Map<string, number>()
  for (const category of categories) {
    const products = new Set<string>()
    const visited = new Set<string>()
    const stack = [category.id]
    while (stack.length > 0) {
      const id = stack.pop()!
      if (visited.has(id)) continue
      visited.add(id)
      for (const productId of productsOf.get(id) ?? []) products.add(productId)
      stack.push(...(childrenOf.get(id) ?? []))
    }
    counts.set(category.id, products.size)
  }
  return counts
}

export async function loadNavCategories(prisma: PrismaClient): Promise<CategoryNode[]> {
  const cached = navCache.get(NAV_KEY)
  if (cached) return cached

  const [categories, links] = await Promise.all([
    prisma.category.findMany({ where: ACTIVE, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.productCategory.findMany({
      where: { product: { ...ACTIVE, variants: { some: ACTIVE }, ...productVisibleFor(null) } },
      select: { categoryId: true, productId: true },
    }),
  ])
  const counts = countCategoryProducts(categories, links)
  const nav = categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    seoTitle: category.seoTitle,
    seoDescription: category.seoDescription,
    parentId: category.parentId,
    productCount: counts.get(category.id) ?? 0,
    updatedAt: category.updatedAt,
  }))
  navCache.set(NAV_KEY, nav)
  return nav
}

export async function loadVisibleProductsForSitemap(prisma: PrismaClient) {
  return prisma.product.findMany({
    where: { ...ACTIVE, variants: { some: ACTIVE }, ...productVisibleFor(null) },
    select: { slug: true, updatedAt: true },
    orderBy: { slug: 'asc' },
  })
}

export async function loadPublicPostsForSitemap(prisma: PrismaClient) {
  return prisma.post.findMany({
    where: { deletedAt: null, isActive: true, audience: 'public', publishedAt: { lte: new Date() } },
    select: { slug: true, kind: true, updatedAt: true },
    orderBy: { slug: 'asc' },
  })
}
