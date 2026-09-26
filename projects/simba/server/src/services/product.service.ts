import { PrismaClient } from '@prisma/client'
import { isSellable, type Variant } from '@simba/shared'
import { buildTagCondition, isCatalogTag } from '../lib/catalog-tags'

/** Ветеринарные линейки, представленные в каталоге. */
// Названия — как они реально написаны в каталоге, включая опечатку «Gactroenteric»:
// сверка ведётся по вхождению без учёта регистра, и здесь, и в фильтре каталога.
export const MEDICAL_LINES = [
  'Vet Life',
  'VetSolution',
  'Prescription Diet',
  'VET Diet',
  'VetDiet',
  'Forza 10 Intestinal',
  'Forza10 Intestinal',
  'Gastroenteric',
  'Gactroenteric',
  'Integra Protect',
  'Royal Canin Renal',
]
/** Узлы «Лечебное питание» в дереве категорий (backfill-category-tree.ts). Фиксированные slug'и,
    а не суффикс: переименование категории в админке не должно молча ломать фильтр. */
export const MEDICAL_CATEGORY_SLUGS = ['dogs-medical', 'cats-medical']
/** Бренды только для кошек (сравнение без учёта регистра). */
// Только бренды, у которых в каталоге НЕТ собачьих позиций. ZILLII сюда не годится:
// в МоемСкладе у него и кошачьи, и собачьи товары в одной папке «Корм/Zillii».
export const CAT_ONLY_BRANDS = ['Matisse']

export interface ProductFilters {
  categorySlug?: string
  brandSlug?: string
  filterValueIds?: string[]
  minPrice?: number
  maxPrice?: number
  search?: string
  /** Сухой или влажный корм. Признак берётся из тегов подбора. */
  format?: 'dry' | 'wet'
  /** Кому товар: кошке или собаке. Универсальные (both) попадают в обе выдачи,
      неразмеченные (unknown) — ни в одну: лучше не показать товар, чем предложить
      кошачий корм собаке. Разметку ставит scripts/backfill-species.ts. */
  species?: 'cat' | 'dog'
  /** Ветеринарные диеты. Отдельного признака у товара нет — отбираем по линейке. */
  purpose?: 'medical'
  /** Быстрые фильтры-кнопки над выдачей. */
  tags?: string[]
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular' | 'in_stock'
  featured?: boolean
  page?: number
  limit?: number
}


/** Получить все id категории и её потомков (BFS). Возвращает null если категория не найдена. */
async function categoryIdsWithDescendants(prisma: PrismaClient, slug: string): Promise<string[] | null> {
  const root = await prisma.category.findUnique({
    where: { slug },
    select: { id: true },
  })
  if (!root) return null

  const ids = [root.id]
  let frontier = [root.id]

  while (frontier.length > 0) {
    const children = await prisma.category.findMany({
      where: { parentId: { in: frontier }, isActive: true },
      select: { id: true },
    })
    frontier = children.map((c) => c.id)
    ids.push(...frontier)
  }

  return ids
}

/** Поля карточки в выдаче каталога. Общие для обычной ветки и сортировки по цене —
    иначе две ветки незаметно разъедутся по форме ответа. */
const productListSelect = {
  id: true,
  name: true,
  slug: true,
  images: true,
  isGrainFree: true,
  isHypoallergenic: true,
  brand: { select: { name: true } },
  variants: {
    where: { isActive: true },
    orderBy: { weight: 'asc' },
    select: {
      id: true,
      weight: true,
      price: true,
      oldPrice: true,
      stock: true,
    },
  },
} as const

export async function getProducts(prisma: PrismaClient, filters: ProductFilters) {
  const page = filters.page ?? 1
  const limit = Math.min(filters.limit ?? 20, 100)
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = { isActive: true }

  if (filters.search) {
    where.name = { contains: filters.search, mode: 'insensitive' }
  }

  if (filters.brandSlug) {
    where.brand = { slug: filters.brandSlug }
  }

  if (filters.categorySlug) {
    const categoryIds = await categoryIdsWithDescendants(prisma, filters.categorySlug)
    if (categoryIds === null) {
      // Категория не найдена — вернуть пустой результат, как раньше
      return { items: [], total: 0, page, totalPages: 0 }
    }
    where.categories = {
      some: { categoryId: { in: categoryIds } },
    }
  }

  if (filters.filterValueIds && filters.filterValueIds.length > 0) {
    where.AND = filters.filterValueIds.map((filterValueId) => ({
      filterValues: { some: { filterValueId } },
    }))
  }

  if (filters.tags && filters.tags.length > 0) {
    const conditions = filters.tags.filter(isCatalogTag).map(buildTagCondition)
    if (conditions.length > 0) {
      where.AND = Array.isArray(where.AND) ? [...where.AND, ...conditions] : conditions
    }
  }

  if (filters.purpose === 'medical') {
    // Ищем категорию типа medical среди активных категорий товара
    const medicalCategories = await prisma.category.findMany({
      where: { slug: { in: MEDICAL_CATEGORY_SLUGS }, isActive: true },
      select: { id: true },
    })

    if (medicalCategories.length > 0) {
      const medicalCategoryIds = medicalCategories.map((c) => c.id)
      const condition = {
        categories: { some: { categoryId: { in: medicalCategoryIds } } },
      }
      where.AND = Array.isArray(where.AND) ? [...where.AND, condition] : [condition]
    } else {
      // Fallback: если категорий нет, используем названия линеек
      const condition = {
        OR: MEDICAL_LINES.map((line) => ({
          name: { contains: line, mode: 'insensitive' as const },
        })),
      }
      where.AND = Array.isArray(where.AND) ? [...where.AND, condition] : [condition]
    }
  }

  if (filters.species) {
    where.species = { in: [filters.species, 'both'] }
  }

  if (filters.format) {
    // Отдельной колонки «формат» у товара нет: сухой/влажный проставлен тегами
    // подбора, ручными или выведенными из прайса.
    const tag = `format:${filters.format}`
    const condition = { OR: [{ quizTags: { has: tag } }, { autoQuizTags: { has: tag } }] }
    where.AND = Array.isArray(where.AND) ? [...where.AND, condition] : [condition]
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.variants = {
      some: {
        isActive: true,
        ...(filters.minPrice !== undefined && { price: { gte: filters.minPrice } }),
        ...(filters.maxPrice !== undefined && { price: { lte: filters.maxPrice } }),
      },
    }
  }

  if (filters.featured) {
    where.isFeatured = true
  }

  const orderBy = buildOrderBy(filters.sortBy)

  // Сортировка по цене — особый случай: цена лежит у вариантов, а Prisma не умеет
  // orderBy по минимальной цене связи внутри findMany. Раньше здесь стоял
  // комментарий «делается после выборки», но самой постобработки в файле не было —
  // price_asc/price_desc молча отдавали порядок по дате. Берём порядок и страницу
  // через groupBy по вариантам, затем догружаем товары и восстанавливаем порядок.
  if (filters.sortBy === 'price_asc' || filters.sortBy === 'price_desc') {
    const direction = filters.sortBy === 'price_asc' ? 'asc' : 'desc'
    const priceWhere = { ...where, variants: { some: { isActive: true } } }

    const [grouped, total] = await Promise.all([
      prisma.productVariant.groupBy({
        by: ['productId'],
        where: { isActive: true, product: where },
        _min: { price: true },
        orderBy: { _min: { price: direction } },
        skip,
        take: limit,
      }),
      prisma.product.count({ where: priceWhere }),
    ])

    const ids = grouped.map((g) => g.productId)
    const found = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: productListSelect,
    })
    const byId = new Map(found.map((p) => [p.id, p]))
    const items = ids.map((id) => byId.get(id)).filter((p): p is (typeof found)[number] => Boolean(p))

    return { items, total, page, totalPages: Math.ceil(total / limit) }
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: productListSelect,
    }),
    prisma.product.count({ where }),
  ])

  const sorted = filters.sortBy === 'in_stock' ? sortItemsByStock(items) : items

  return {
    items: sorted,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
}

export async function getProductBySlug(prisma: PrismaClient, slug: string) {
  return prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      brand: { select: { id: true, name: true, slug: true } },
      categories: {
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      },
      variants: {
        where: { isActive: true },
        orderBy: { weight: 'asc' },
        select: {
          id: true,
          weight: true,
          price: true,
          oldPrice: true,
          stock: true,
          sku: true,
        },
      },
      filterValues: {
        include: {
          filterValue: {
            include: {
              filter: { select: { name: true } },
            },
          },
        },
      },
    },
  })
}

export async function getRelatedProducts(
  prisma: PrismaClient,
  productId: string,
  categoryIds: string[],
) {
  return prisma.product.findMany({
    where: {
      isActive: true,
      id: { not: productId },
      categories: {
        some: { categoryId: { in: categoryIds } },
      },
    },
    take: 4,
    select: {
      id: true,
      name: true,
      slug: true,
      images: true,
      isGrainFree: true,
      isHypoallergenic: true,
      brand: { select: { name: true } },
      variants: {
        where: { isActive: true },
        orderBy: { weight: 'asc' },
        select: {
          id: true,
          weight: true,
          price: true,
          oldPrice: true,
          stock: true,
        },
      },
    },
  })
}

function buildOrderBy(sortBy?: string): Record<string, unknown> | Record<string, unknown>[] {
  switch (sortBy) {
    case 'newest':
      return { createdAt: 'desc' }
    case 'popular':
      return { orderItems: { _count: 'desc' } }
    case 'price_asc':
    case 'price_desc':
      // Сортировка по минимальной цене варианта делается после выборки
      return { createdAt: 'desc' }
    case 'in_stock':
      // Сортировка по наличию делается после выборки (как цена)
      return { createdAt: 'desc' }
    default:
      return { createdAt: 'desc' }
  }
}

export function sortItemsByPrice(
  items: Array<{ variants: Array<{ price: number }> }>,
  sortBy?: string,
) {
  if (sortBy !== 'price_asc' && sortBy !== 'price_desc') return items

  return [...items].sort((a, b) => {
    const minA = Math.min(...a.variants.map((v) => v.price))
    const minB = Math.min(...b.variants.map((v) => v.price))
    return sortBy === 'price_asc' ? minA - minB : minB - minA
  })
}

export function sortItemsByStock(
  items: Array<{ variants: Variant[] }>,
) {
  // Стабильная сортировка: товары с продаваемым вариантом перед остальными,
  // порядок внутри каждой группы сохраняется
  return [...items].sort((a, b) => {
    const aSellable = a.variants.some((v) => isSellable(v))
    const bSellable = b.variants.some((v) => isSellable(v))
    return bSellable ? (aSellable ? 0 : 1) : (aSellable ? -1 : 0)
  })
}
