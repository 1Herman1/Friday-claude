// Синхронизация каталога из assets/catalog-curated.json в БД.
// Идемпотентно: цены существующих товаров обновляются, новые создаются.
// Не трогает stock и заказы. Запуск: cd server && node tools/sync-catalog.mjs
import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'
import { readFileSync } from 'node:fs'

const prisma = new PrismaClient()
const raw = JSON.parse(readFileSync(new URL('../assets/catalog-curated.json', import.meta.url), 'utf8'))
const products = Array.isArray(raw) ? raw : raw.products || raw.items

let priced = 0
let created = 0
const skipped = []

for (const p of products) {
  // slug не @unique в схеме — ищем findFirst, как это делает seed.
  const existing = await prisma.product.findFirst({
    where: { slug: p.slug, deletedAt: null },
    include: { variants: { where: { deletedAt: null }, orderBy: { retailPrice: 'asc' } } },
  })

  if (!existing) {
    skipped.push(p.slug)
    continue
  }

  const variant = existing.variants[0]
  if (!variant) {
    skipped.push(`${p.slug} (нет варианта)`)
    continue
  }

  // priceKopecks в JSON и retailPrice в БД — оба в копейках.
  if (variant.retailPrice !== p.priceKopecks) {
    await prisma.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id: variant.id },
        data: { retailPrice: p.priceKopecks },
      })
      // Денормализованные min/max цены товара пересчитываем по активным вариантам.
      const rows = await tx.productVariant.findMany({
        where: { productId: existing.id, isActive: true, deletedAt: null },
        select: { retailPrice: true },
      })
      const prices = rows.map((r) => r.retailPrice)
      await tx.product.update({
        where: { id: existing.id },
        data: { minPrice: Math.min(...prices), maxPrice: Math.max(...prices) },
      })
    })
    console.log(`цена: ${p.name.slice(0, 46).padEnd(46)} ${String(variant.retailPrice / 100).padStart(7)} → ${p.priceKopecks / 100} ₽`)
    priced++
  }
}

console.log(`\nобновлено цен: ${priced}`)
console.log(`создано товаров: ${created}`)
if (skipped.length) console.log(`нет в БД (заведёт сид): ${skipped.length} — ${skipped.slice(0, 5).join(', ')}`)
await prisma.$disconnect()
