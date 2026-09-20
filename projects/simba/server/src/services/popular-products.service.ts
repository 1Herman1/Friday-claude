import { PrismaClient } from '@prisma/client'

const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  images: true,
  isGrainFree: true,
  isHypoallergenic: true,
  brand: { select: { name: true } },
  variants: {
    where: { isActive: true },
    orderBy: { weight: 'asc' as const },
    select: {
      id: true,
      weight: true,
      price: true,
      oldPrice: true,
      stock: true,
    },
  },
} as const

type ProductItem = {
  id: string
  name: string
  slug: string
  images: string[]
  isGrainFree: boolean
  isHypoallergenic: boolean
  brand: { name: string } | null
  variants: Array<{
    id: string
    weight: number
    price: number
    oldPrice: number | null
    stock: number
  }>
}

export type PopularProductsResponse = {
  items: ProductItem[]
  basis: 'sales' | 'curated'
}

export async function getPopularProducts(
  prisma: PrismaClient,
  limit: number = 8,
): Promise<PopularProductsResponse> {
  const maxLimit = Math.min(limit, 12)

  // Шаг 1: Популярность по продажам за последние 60 дней
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  const salesByProduct = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      createdAt: { gte: sixtyDaysAgo },
      order: {
        status: { in: ['confirmed', 'in_transit', 'delivered'] },
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: maxLimit,
  })

  const topProductIds = salesByProduct.map(s => s.productId)

  // Загружаем топовые товары с проверкой isActive.
  // ВНИМАНИЕ: `IN (...)` не сохраняет порядок — база вернёт строки как ей
  // удобно, и рейтинг, честно посчитанный groupBy выше, потеряется. Раньше
  // именно так и было: секция «Популярные товары» показывала их в произвольном
  // порядке, а тест на это падал через раз. Восстанавливаем порядок по списку.
  const found = await prisma.product.findMany({
    where: {
      id: { in: topProductIds },
      isActive: true,
    },
    select: PRODUCT_SELECT,
  })
  const byId = new Map(found.map((p) => [p.id, p]))
  const topProducts = topProductIds
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  // Если топовых товаров достаточно (>= 4), возвращаем
  if (topProducts.length >= 4) {
    return {
      items: topProducts.slice(0, maxLimit),
      basis: 'sales',
    }
  }

  const itemsSet = new Set(topProducts.map(p => p.id))

  // Шаг 2: Дополняем featured товарами
  const featuredProducts = await prisma.product.findMany({
    where: {
      isActive: true,
      isFeatured: true,
      id: { notIn: Array.from(itemsSet) },
    },
    select: PRODUCT_SELECT,
    take: maxLimit - topProducts.length,
    orderBy: { createdAt: 'desc' },
  })

  topProducts.push(...featuredProducts)
  featuredProducts.forEach(p => itemsSet.add(p.id))

  // Если достаточно (>= 4), возвращаем
  if (topProducts.length >= 4) {
    return {
      items: topProducts.slice(0, maxLimit),
      basis: 'curated',
    }
  }

  // Шаг 3: Дополняем новыми товарами с stock > 0 и изображениями
  const allNewProducts = await prisma.product.findMany({
    where: {
      isActive: true,
      id: { notIn: Array.from(itemsSet) },
      variants: {
        some: {
          stock: { gt: 0 },
          isActive: true,
        },
      },
    },
    select: PRODUCT_SELECT,
    orderBy: { createdAt: 'desc' },
  })

  // Наличие фотографии не требуем: в каталоге её сейчас нет ни у одного товара,
  // и с таким условием секция оставалась пустой. Карточка без фото показывает
  // заглушку-лапу, так что витрина выглядит целой.
  const newProducts = allNewProducts
    .filter((p) => !topProducts.some((t) => t.id === p.id))
    .slice(0, maxLimit - topProducts.length)

  topProducts.push(...newProducts)

  return {
    items: topProducts.slice(0, maxLimit),
    basis: 'curated',
  }
}
