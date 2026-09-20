import type { PrismaClient, Prisma } from '../lib/db.js'
import { ACTIVE } from '../lib/prisma-filters.js'
import { CONCERNS, SKIN_TYPES } from '../lib/dictionaries.js'
import type { Concern, SkinType } from '../lib/db.js'
import { getPopularProductsMap } from './popular.service.js'
import { isWholesaleViewer, resolvePrice, type PriceViewer } from '../lib/pricing.js'

export interface CatalogFilters {
  q?: string
  category?: string
  brand?: string[]
  line?: string[]
  need?: string[]
  skin?: string[]
  minPrice?: number
  maxPrice?: number
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'popular'
  pro?: boolean
  limit: number
  offset: number
}

export interface ProductCardDTO {
  id: string
  slug: string
  name: string
  brand: { id: string; name: string; slug: string } | null
  line: { id: string; name: string; slug: string } | null
  image: string | null
  skinTypes: string[]
  needs: string[]
  minPrice: number | null
  oldPrice: number | null
  inStock: boolean
  isProfessional: boolean
  priceHidden: boolean
  variants: VariantDTO[]
}

export interface VariantDTO {
  id: string
  volumeValue: number
  volumeUnit: string
  volumeLabel: string
  retailPrice: number | null
  oldRetailPrice: number | null
  stock: number
  sku: string | null
  isProfessional: boolean
  priceHidden: boolean
}

// Build volume label from variant data
function buildVolumeLabel(volumeValue: number, volumeUnit: string, label: string | null): string {
  if (label) return label
  const units: Record<string, string> = { ml: 'мл', g: 'г', pcs: 'шт' }
  // volumeValue уже число без хвостовых нулей (decimalToNumber); regex-обрезка
  // превращала «200» в «2».
  return `${volumeValue} ${units[volumeUnit] || volumeUnit}`
}

// Convert Prisma Decimal to number and strip trailing zeros
function decimalToNumber(val: Prisma.Decimal | number | null): number {
  if (val === null) return 0
  const str = String(val)
  const num = parseFloat(str)
  return Number.isInteger(num) ? num : num
}

type ProductWithBrandLineVariants = Prisma.ProductGetPayload<{
  include: {
    brand: true
    line: true
    variants: {
      where: { isActive: boolean; deletedAt: null }
      orderBy: { volumeValue: 'asc' }
    }
  }
}>

type ProductWithRelations = ProductWithBrandLineVariants | (ProductWithBrandLineVariants & { categories: Prisma.ProductCategoryGetPayload<object>[] })

// Build product card DTO from product record
export function buildProductCard(product: ProductWithRelations, viewer: PriceViewer = null): ProductCardDTO {
  const images = product.images || []
  const brand = product.brand
    ? { id: product.brand.id, name: product.brand.name, slug: product.brand.slug }
    : null
  const line = product.line
    ? { id: product.line.id, name: product.line.name, slug: product.line.slug }
    : null

  // Определяем видна ли цена: скрыта если товар профессиональный И viewer не оптовый покупатель
  const productPriceHidden = product.isProfessional && !isWholesaleViewer(viewer)

  // Filter active variants (already pre-filtered by ProductGetPayload)
  const activeVariants = (product.variants || [])

  // Отфильтруем видимые варианты (учитываем как профессиональный статус товара, так и варианта)
  const visibleVariants = activeVariants.filter((v) => {
    // Вариант видимый если товар не скрывает все цены И вариант не профессиональный ИЛИ viewer оптовый
    if (productPriceHidden) return false
    const variantHidden = v.isProfessional && !isWholesaleViewer(viewer)
    return !variantHidden
  })

  // Find cheapest visible variant
  const cheapest = visibleVariants.length > 0 ? visibleVariants[0] : null

  let minPrice: number | null = null
  let oldPrice: number | null = null

  if (cheapest) {
    // Видимая цена — используем resolved prices
    const resolvedPrice = resolvePrice({ retailPrice: decimalToNumber(cheapest.retailPrice), wholesalePrice: cheapest.wholesalePrice }, viewer)
    minPrice = resolvedPrice
    // oldPrice становится розничной если применена оптовая цена
    if (isWholesaleViewer(viewer) && cheapest.wholesalePrice && cheapest.wholesalePrice > 0) {
      oldPrice = decimalToNumber(cheapest.retailPrice)
    } else if (cheapest.oldRetailPrice) {
      oldPrice = decimalToNumber(cheapest.oldRetailPrice)
    }
  }

  // Check if in stock (только видимые варианты)
  const inStock = visibleVariants.some((v) => (v.stock || 0) > 0)

  // Если нет видимых вариантов — товар целиком скрыт
  const finalProductPriceHidden = productPriceHidden || visibleVariants.length === 0

  // Convert variants to DTO
  const variants: VariantDTO[] = activeVariants.map((v) => {
    const variantPriceHidden = v.isProfessional && !isWholesaleViewer(viewer)
    const shouldHidePrice = productPriceHidden || variantPriceHidden

    if (shouldHidePrice) {
      return {
        id: v.id,
        volumeValue: decimalToNumber(v.volumeValue),
        volumeUnit: v.volumeUnit,
        volumeLabel: buildVolumeLabel(decimalToNumber(v.volumeValue), v.volumeUnit, v.volumeLabel),
        retailPrice: null,
        oldRetailPrice: null,
        stock: v.stock || 0,
        sku: v.sku || null,
        isProfessional: v.isProfessional,
        priceHidden: true,
      }
    }
    const resolvedPrice = resolvePrice({ retailPrice: decimalToNumber(v.retailPrice), wholesalePrice: v.wholesalePrice }, viewer)
    return {
      id: v.id,
      volumeValue: decimalToNumber(v.volumeValue),
      volumeUnit: v.volumeUnit,
      volumeLabel: buildVolumeLabel(decimalToNumber(v.volumeValue), v.volumeUnit, v.volumeLabel),
      retailPrice: resolvedPrice,
      oldRetailPrice: isWholesaleViewer(viewer) && v.wholesalePrice && v.wholesalePrice > 0
        ? decimalToNumber(v.retailPrice)
        : v.oldRetailPrice ? decimalToNumber(v.oldRetailPrice) : null,
      stock: v.stock || 0,
      sku: v.sku || null,
      isProfessional: v.isProfessional,
      priceHidden: false,
    }
  })

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand,
    line,
    image: images.length > 0 ? images[0] : null,
    skinTypes: product.skinTypes || [],
    needs: product.concerns || [],
    minPrice,
    oldPrice,
    inStock,
    isProfessional: product.isProfessional,
    priceHidden: finalProductPriceHidden,
    variants,
  }
}

export async function getProducts(
  prisma: PrismaClient,
  filters: CatalogFilters,
  viewer: PriceViewer = null
): Promise<{ items: ProductCardDTO[]; total: number; limit: number; offset: number }> {
  // Build where clause
  const where: any = {
    ...ACTIVE,
    variants: {
      some: {
        ...ACTIVE,
      },
    },
  }

  const andConditions: any[] = []

  // Text search: ILIKE over name/descriptions/brand. On 57 products a
  // pg_trgm index is unnecessary; add one when the catalog grows.
  if (filters.q) {
    andConditions.push({
      OR: [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { shortDescription: { contains: filters.q, mode: 'insensitive' } },
        { description: { contains: filters.q, mode: 'insensitive' } },
        { brand: { name: { contains: filters.q, mode: 'insensitive' } } },
      ]
    })
  }

  // Professional products filter: товар профессиональный ИЛИ имеет профессиональные варианты
  if (filters.pro) {
    andConditions.push({
      OR: [
        { isProfessional: true },
        { variants: { some: { isProfessional: true, isActive: true, deletedAt: null } } },
      ]
    })
  }

  if (andConditions.length > 0) {
    where.AND = andConditions
  }

  // Category filter (recursive to get children)
  if (filters.category) {
    const category = await prisma.category.findFirst({
      where: { slug: filters.category, ...ACTIVE },
      select: { id: true },
    })

    if (category) {
      // Collect this category and all descendants
      const categoryIds = [category.id]
      const queue = [category.id]

      while (queue.length > 0) {
        const current = queue.shift()!
        const children = await prisma.category.findMany({
          where: { parentId: current, ...ACTIVE },
          select: { id: true },
        })
        children.forEach((c) => {
          categoryIds.push(c.id)
          queue.push(c.id)
        })
      }

      where.categories = {
        some: { categoryId: { in: categoryIds } },
      }
    }
  }

  // Brand filter
  if (filters.brand && filters.brand.length > 0) {
    const brands = await prisma.brand.findMany({
      where: {
        slug: { in: filters.brand },
        ...ACTIVE,
      },
      select: { id: true },
    })
    if (brands.length > 0) {
      where.brandId = { in: brands.map((b) => b.id) }
    }
  }

  // Line filter
  if (filters.line && filters.line.length > 0) {
    const lines = await prisma.productLine.findMany({
      where: {
        slug: { in: filters.line },
        ...ACTIVE,
      },
      select: { id: true },
    })
    if (lines.length > 0) {
      where.lineId = { in: lines.map((l) => l.id) }
    }
  }

  // Need filter (concerns)
  if (filters.need && filters.need.length > 0) {
    where.concerns = { hasSome: filters.need }
  }

  // Skin type filter (always include all_types)
  if (filters.skin && filters.skin.length > 0) {
    where.skinTypes = { hasSome: [...filters.skin, 'all_types'] }
  }

  // Price filter - check for active variant in range
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.variants = {
      some: {
        ...ACTIVE,
        retailPrice: {
          ...(filters.minPrice !== undefined && { gte: filters.minPrice }),
          ...(filters.maxPrice !== undefined && { lte: filters.maxPrice }),
        },
      },
    }
  }

  // Apply sort
  let orderBy: any = [{ createdAt: 'desc' }, { id: 'asc' }]

  if (filters.sort === 'price_asc') {
    orderBy = [{ minPrice: 'asc' }, { id: 'asc' }]
  } else if (filters.sort === 'price_desc') {
    orderBy = [{ minPrice: 'desc' }, { id: 'asc' }]
  } else if (filters.sort === 'newest') {
    orderBy = [{ createdAt: 'desc' }, { id: 'asc' }]
  } else if (filters.sort === 'popular') {
    // Optimize popular sorting: lightweight query → in-memory sort → fetch page
    // Get all matching product IDs with popularPin for sorting
    const productRecords = await prisma.product.findMany({
      where,
      select: { id: true, popularPin: true },
    })

    // Get cached popular products map (10-minute TTL)
    const popularMap = await getPopularProductsMap(prisma)

    // Sort in memory: pinned by popularPin asc → unpinned by units desc → id asc
    const sorted = productRecords.sort((a, b) => {
      const aPinned = a.popularPin !== null
      const bPinned = b.popularPin !== null

      // Pinned items first
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      if (aPinned && bPinned) {
        // Both pinned: sort by popularPin ascending
        return a.popularPin! - b.popularPin!
      }

      // Both unpinned: sort by sales units desc
      const unitsA = popularMap.get(a.id) || 0
      const unitsB = popularMap.get(b.id) || 0
      if (unitsA !== unitsB) return unitsB - unitsA
      return a.id.localeCompare(b.id)
    })

    // Apply limit/offset to get page IDs
    const total = sorted.length
    const pageIds = sorted
      .slice(filters.offset, filters.offset + filters.limit)
      .map((p) => p.id)

    // Fetch full product data for page items
    const pageProducts = await prisma.product.findMany({
      where: { id: { in: pageIds } },
      include: {
        brand: true,
        line: true,
        variants: {
          where: ACTIVE,
          orderBy: { volumeValue: 'asc' },
        },
      },
    })

    // Restore original page order (as sorted above)
    const orderedByPage = pageIds.map((id) => pageProducts.find((p) => p.id === id)!)

    return {
      items: orderedByPage.map((p) => buildProductCard(p, viewer)),
      total,
      limit: filters.limit,
      offset: filters.offset,
    }
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        brand: true,
        line: true,
        variants: {
          where: ACTIVE,
          orderBy: { volumeValue: 'asc' },
        },
      },
      orderBy,
      take: filters.limit,
      skip: filters.offset,
    }),
    prisma.product.count({ where }),
  ])

  return {
    items: items.map((p) => buildProductCard(p, viewer)),
    total,
    limit: filters.limit,
    offset: filters.offset,
  }
}

export async function getFacets(
  prisma: PrismaClient,
  filters: Omit<CatalogFilters, 'sort' | 'limit' | 'offset'>
): Promise<any> {
  // Resolve slugs → IDs once before all groups
  let categoryIds: string[] | null = null
  if (filters.category) {
    const category = await prisma.category.findFirst({
      where: { slug: filters.category, ...ACTIVE },
      select: { id: true },
    })
    if (category) {
      categoryIds = [category.id]
      const queue = [category.id]
      while (queue.length > 0) {
        const current = queue.shift()!
        const children = await prisma.category.findMany({
          where: { parentId: current, ...ACTIVE },
          select: { id: true },
        })
        children.forEach((c) => {
          categoryIds!.push(c.id)
          queue.push(c.id)
        })
      }
    }
  }

  let brandIds: string[] | null = null
  if (filters.brand && filters.brand.length > 0) {
    const brands = await prisma.brand.findMany({
      where: { slug: { in: filters.brand }, ...ACTIVE },
      select: { id: true },
    })
    if (brands.length > 0) {
      brandIds = brands.map((b) => b.id)
    }
  }

  let lineIds: string[] | null = null
  if (filters.line && filters.line.length > 0) {
    const lines = await prisma.productLine.findMany({
      where: { slug: { in: filters.line }, ...ACTIVE },
      select: { id: true },
    })
    if (lines.length > 0) {
      lineIds = lines.map((l) => l.id)
    }
  }

  // Build base where clause (without the filter group being queried)
  const buildBaseWhere = (excludeGroup?: string): any => {
    const where: any = {
      ...ACTIVE,
      variants: { some: ACTIVE },
    }

    if (excludeGroup !== 'category' && categoryIds) {
      where.categories = { some: { categoryId: { in: categoryIds } } }
    }

    if (excludeGroup !== 'brand' && brandIds) {
      where.brandId = { in: brandIds }
    }

    if (excludeGroup !== 'line' && lineIds) {
      where.lineId = { in: lineIds }
    }

    if (excludeGroup !== 'need' && filters.need && filters.need.length > 0) {
      where.concerns = { hasSome: filters.need }
    }

    if (excludeGroup !== 'skin' && filters.skin && filters.skin.length > 0) {
      where.skinTypes = { hasSome: [...filters.skin, 'all_types'] }
    }

    if (
      excludeGroup !== 'price' &&
      (filters.minPrice !== undefined || filters.maxPrice !== undefined)
    ) {
      where.variants = {
        some: {
          ...ACTIVE,
          retailPrice: {
            ...(filters.minPrice !== undefined && { gte: filters.minPrice }),
            ...(filters.maxPrice !== undefined && { lte: filters.maxPrice }),
          },
        },
      }
    }

    return where
  }

  // Query for all facet groups
  const baseWhere = buildBaseWhere()
  const products = await prisma.product.findMany({
    where: baseWhere,
    select: {
      id: true,
      brandId: true,
      lineId: true,
      skinTypes: true,
      concerns: true,
      categories: { select: { categoryId: true } },
      variants: { where: ACTIVE, select: { retailPrice: true } },
    },
  })

  // Get categories (excluding category filter)
  const categoryWhere = buildBaseWhere('category')
  const categoriesWithCount = new Map<string, { label: string; count: number }>()
  const categoryProducts = await prisma.product.findMany({
    where: categoryWhere,
    select: { categories: { select: { categoryId: true } } },
  })
  for (const p of categoryProducts) {
    for (const pc of p.categories) {
      categoriesWithCount.set(pc.categoryId, { label: '', count: 0 }) // временный ключ-id, заменяется slug'ом ниже
    }
  }

  const categoryIdsFromCount = Array.from(categoriesWithCount.keys())
  if (categoryIdsFromCount.length > 0) {
    const cats = await prisma.category.findMany({
      where: { id: { in: categoryIdsFromCount }, ...ACTIVE },
    })
    for (const cat of cats) {
      const count = categoryProducts.filter((p) =>
        p.categories.some((c) => c.categoryId === cat.id)
      ).length
      // По контракту value — slug: id в фильтр не подставишь.
      categoriesWithCount.set(cat.slug, { label: cat.name, count })
    }
    for (const id of categoryIdsFromCount) categoriesWithCount.delete(id)
  }

  // Get brands
  const brandWhere = buildBaseWhere('brand')
  const brandsData = await prisma.product.findMany({
    where: brandWhere,
    select: { brandId: true },
  })
  const brandIdsFromCount = Array.from(new Set(brandsData.filter((p) => p.brandId).map((p) => p.brandId)))
  const brandsWithCount = new Map<string, { label: string; count: number }>()
  if (brandIdsFromCount.length > 0) {
    const brands = await prisma.brand.findMany({
      where: { id: { in: brandIdsFromCount as string[] }, ...ACTIVE },
    })
    for (const brand of brands) {
      const count = brandsData.filter((p) => p.brandId === brand.id).length
      brandsWithCount.set(brand.slug, { label: brand.name, count })
    }
  }

  // Get lines
  const lineWhere = buildBaseWhere('line')
  const linesData = await prisma.product.findMany({
    where: lineWhere,
    select: { lineId: true },
  })
  const lineIdsFromCount = Array.from(new Set(linesData.filter((p) => p.lineId).map((p) => p.lineId)))
  const linesWithCount = new Map<string, { label: string; count: number }>()
  if (lineIdsFromCount.length > 0) {
    const lines = await prisma.productLine.findMany({
      where: { id: { in: lineIdsFromCount as string[] }, ...ACTIVE },
    })
    for (const line of lines) {
      const count = linesData.filter((p) => p.lineId === line.id).length
      linesWithCount.set(line.slug, { label: line.name, count })
    }
  }

  // Count concerns
  const concernsCount = new Map<Concern, number>()
  const needWhere = buildBaseWhere('need')
  const needProducts = await prisma.product.findMany({
    where: needWhere,
    select: { concerns: true },
  })
  for (const p of needProducts) {
    for (const concern of p.concerns) {
      concernsCount.set(concern, (concernsCount.get(concern) || 0) + 1)
    }
  }

  // Count skin types
  const skinCount = new Map<SkinType, number>()
  const skinWhere = buildBaseWhere('skin')
  const skinProducts = await prisma.product.findMany({
    where: skinWhere,
    select: { skinTypes: true },
  })
  for (const p of skinProducts) {
    for (const skin of p.skinTypes) {
      if (skin !== 'all_types') {
        skinCount.set(skin, (skinCount.get(skin) || 0) + 1)
      }
    }
  }

  // Get price range
  const priceWhere = buildBaseWhere('price')
  const priceData = await prisma.product.findMany({
    where: priceWhere,
    select: { variants: { where: ACTIVE, select: { retailPrice: true } } },
  })
  let minPrice = Infinity
  let maxPrice = 0
  for (const p of priceData) {
    for (const v of p.variants) {
      const price = decimalToNumber(v.retailPrice)
      minPrice = Math.min(minPrice, price)
      maxPrice = Math.max(maxPrice, price)
    }
  }
  if (minPrice === Infinity) minPrice = 0

  return {
    categories: Array.from(categoriesWithCount.entries())
      .map(([id, { label, count }]) => ({ value: id, label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    brands: Array.from(brandsWithCount.entries())
      .map(([slug, { label, count }]) => ({ value: slug, label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    lines: Array.from(linesWithCount.entries())
      .map(([slug, { label, count }]) => ({ value: slug, label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    needs: Array.from(concernsCount.entries())
      .map(([value, count]) => ({ value, label: CONCERNS[value] || value, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    skinTypes: Array.from(skinCount.entries())
      .map(([value, count]) => ({ value, label: SKIN_TYPES[value] || value, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    price: { min: minPrice, max: maxPrice },
  }
}

export async function getProductBySlug(
  prisma: PrismaClient,
  slug: string,
  viewer: PriceViewer = null
): Promise<any | null> {
  const product = await prisma.product.findFirst({
    where: { slug, ...ACTIVE },
    include: {
      brand: true,
      line: true,
      variants: { where: ACTIVE, orderBy: { volumeValue: 'asc' } },
      categories: { include: { category: true } },
      ingredients: {
        include: { ingredient: true },
        orderBy: [{ isKey: 'desc' }, { sortOrder: 'asc' }, { ingredient: { name: 'asc' } }],
      },
    },
  })

  if (!product) return null

  const card = buildProductCard(product, viewer)

  return {
    ...card,
    images: product.images || [],
    shortDescription: product.shortDescription,
    description: product.description,
    usage: product.usage,
    inciText: product.inciText,
    ingredients: product.ingredients.map((pi: any) => ({
      name: pi.ingredient.name,
      slug: pi.ingredient.slug,
      concentration: pi.concentration,
      isKey: pi.isKey,
    })),
    categories: product.categories.map((pc: any) => ({
      name: pc.category.name,
      slug: pc.category.slug,
    })),
    seo: {
      title: product.seoTitle,
      description: product.seoDescription,
    },
  }
}
