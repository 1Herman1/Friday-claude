import type { PrismaClient } from '../lib/db.js'

interface PopularCacheEntry {
  data: Map<string, number> // productId -> units sold
  timestamp: number
}

const CACHE_TTL = 10 * 60 * 1000 // 10 minutes
let cache: PopularCacheEntry | null = null

export async function getPopularProductsMap(prisma: PrismaClient): Promise<Map<string, number>> {
  // Check if cache is valid
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data
  }

  // Calculate sales for last 90 days
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const salesData = await prisma.orderItem.groupBy({
    by: ['productId'],
    _sum: { quantity: true },
    where: {
      createdAt: { gte: cutoffDate },
      order: { status: { not: 'cancelled' } },
    },
  })

  const data = new Map(
    salesData.map((s) => [s.productId, s._sum?.quantity || 0])
  )

  cache = { data, timestamp: Date.now() }
  return data
}

export function clearPopularCache() {
  cache = null
}
