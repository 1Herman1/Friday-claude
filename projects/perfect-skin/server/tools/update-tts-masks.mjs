// Обновляет TTS маски: существующие варианты → 6 шт, добавляет варианты → 1 шт.
// Идемпотентно по SKU.
// Запуск: cd server && node tools/update-tts-masks.mjs [путь-к-price-items.json] [--apply]
import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'
import { readFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()
const items = JSON.parse(readFileSync(process.argv[2] || '/tmp/claude-0/-home-user-project-simba/1749002d-5615-562f-864f-d89af882543c/scratchpad/price-items.json', 'utf8'))

// TTS маски: ищем по SKU (6 шт вариант)
const TTS_MASKS = [
  { sku: '2027', name: 'TTS Energizing' },
  { sku: '2028', name: 'TTS Moisturizing' },
  { sku: '2029', name: 'TTS Essential' },
  { sku: '2031', name: 'TTS Brightening' }
]

const priceItemsBySku = new Map(items.filter(it => it.art).map(it => [it.art, it]))

let updated = 0
let added = 0

for (const mask of TTS_MASKS) {
  const priceItem = priceItemsBySku.get(mask.sku)
  if (!priceItem) {
    console.log(`[пропуск] Маска SKU ${mask.sku} не найдена в прайсе`)
    continue
  }

  // Найти существующий вариант по названию товара
  const variant = await prisma.productVariant.findFirst({
    where: {
      product: {
        name: { contains: mask.name, mode: 'insensitive' }
      },
      deletedAt: null
    },
    include: { product: true }
  })

  if (!variant) {
    console.log(`[пропуск] Вариант маски ${mask.name} не найден в БД`)
    continue
  }

  const retailPrice = priceItem.rrc * 100
  const wholesalePrice = priceItem.opt * 100

  if (APPLY) {
    // Обновить существующий вариант (6 шт)
    await prisma.productVariant.update({
      where: { id: variant.id },
      data: {
        volumeValue: 6,
        volumeUnit: 'pcs',
        volumeLabel: '6 шт',
        retailPrice,
        wholesalePrice
      }
    })
    updated++

    // Добавить второй вариант (1 шт), если не существует
    const sku1 = `${mask.sku}-1`
    const existing1 = await prisma.productVariant.findUnique({
      where: { sku: sku1 }
    })

    if (!existing1) {
      const retailPrice1 = Math.ceil((priceItem.rrc / 6) / 100) * 100 * 100
      const wholesalePrice1 = Math.ceil((priceItem.opt / 6) / 100) * 100 * 100

      await prisma.productVariant.create({
        data: {
          productId: variant.productId,
          volumeValue: 1,
          volumeUnit: 'pcs',
          volumeLabel: '1 шт',
          retailPrice: retailPrice1,
          wholesalePrice: wholesalePrice1,
          stock: 0,
          sku: sku1,
          isActive: true
        }
      })
      added++
    }

    // Пересчитать цены товара
    await prisma.$executeRaw`
      UPDATE products p SET
        "minPrice" = COALESCE(v.min_price, 0),
        "maxPrice" = COALESCE(v.max_price, 0)
      FROM (
        SELECT MIN("retailPrice") AS min_price, MAX("retailPrice") AS max_price
        FROM product_variants
        WHERE "productId" = ${variant.productId} AND "isActive" AND "deletedAt" IS NULL
      ) v
      WHERE p.id = ${variant.productId}`
  } else {
    updated++
    added++
  }
}

console.log(`${APPLY ? 'обновлено' : 'готово обновить (пробный прогон)'}: ${updated} вариантов 6-шт`)
console.log(`${APPLY ? 'добавлено' : 'готово добавить (пробный прогон)'}: ${added} вариантов 1-шт`)
if (!APPLY) console.log('\nЗапусти с --apply, чтобы обновить и создать варианты.')
await prisma.$disconnect()
