// Добавляет профессиональные фасовки (увеличенные объёмы) для 4 товаров.
// Идемпотентно по SKU.
// Запуск: cd server && node tools/add-pro-variants.mjs [путь-к-price-items.json] [--apply]
import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'
import { readFileSync } from 'node:fs'

// профи-артикул → розничный артикул того же продукта
const RETAIL_ART = { '2020': '2033', '2021': '2034', '2024': '2038', '10071': '10072' }
const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()
const items = JSON.parse(readFileSync(process.argv[2] || '/tmp/claude-0/-home-user-project-simba/1749002d-5615-562f-864f-d89af882543c/scratchpad/price-items.json', 'utf8'))

// Цели: найти эти SKU в прайсе
const TARGET_SKUS = ['2020', '2021', '2024', '10071']

const volNum = (s) => {
  const m = String(s || '').match(/([\d.,]+)/)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

const priceItemsBySku = new Map(items.filter(it => it.art).map(it => [it.art, it]))

const products = await prisma.product.findMany({
  where: {
    variants: {
      some: { deletedAt: null }
    }
  },
  include: {
    variants: {
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' }
    }
  }
})

let added = 0
const skipped = []
const productIds = new Set()

for (const sku of TARGET_SKUS) {
  const priceItem = priceItemsBySku.get(sku)
  if (!priceItem) {
    console.log(`[пропуск] SKU ${sku} не найден в прайсе`)
    continue
  }

  // Товар ищем по розничному артикулу того же продукта: у профи-фасовки и
  // розничной в прайсе одно название, отличается только объём и артикул.
  const retailArt = RETAIL_ART[sku]
  const product = products.find((p) => p.variants.some((v) => v.sku === retailArt))

  if (!product) {
    console.log(`[пропуск] Товар для ${priceItem.name.slice(0, 40)} не найден`)
    continue
  }

  // Проверить, не существует ли уже вариант с этим SKU
  const existing = await prisma.productVariant.findUnique({
    where: { sku }
  })

  if (existing) {
    skipped.push(`${product.name.slice(0, 40)} (SKU ${sku} уже существует)`)
    continue
  }

  const vol = volNum(priceItem.vol)
  const retailPrice = Math.round(priceItem.opt * 1.9) * 100
  const wholesalePrice = priceItem.opt * 100

  if (APPLY) {
    await prisma.productVariant.create({
      data: {
        productId: product.id,
        volumeValue: vol || 0,
        volumeUnit: 'ml',
        retailPrice,
        wholesalePrice,
        stock: 0,
        sku,
        isActive: true
      }
    })
    productIds.add(product.id)
    added++
  } else {
    added++
  }
}

// Пересчитать цены для изменённых товаров
if (APPLY && productIds.size > 0) {
  for (const productId of productIds) {
    await prisma.$executeRaw`
      UPDATE products p SET
        "minPrice" = COALESCE(v.min_price, 0),
        "maxPrice" = COALESCE(v.max_price, 0)
      FROM (
        SELECT MIN("retailPrice") AS min_price, MAX("retailPrice") AS max_price
        FROM product_variants
        WHERE "productId" = ${productId} AND "isActive" AND "deletedAt" IS NULL
      ) v
      WHERE p.id = ${productId}`
  }
}

console.log(`${APPLY ? 'добавлено' : 'готово добавить (пробный прогон)'}: ${added} профи-фасовок`)
if (skipped.length) {
  console.log(`пропущено: ${skipped.length}`)
  console.log('  ' + skipped.slice(0, 8).join('\n  '))
}
if (!APPLY) console.log('\nЗапусти с --apply, чтобы создать варианты.')
await prisma.$disconnect()
