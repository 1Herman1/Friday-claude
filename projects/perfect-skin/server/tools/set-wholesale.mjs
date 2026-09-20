// Проставляет оптовые цены из прайса BeautyMedGroup в ProductVariant.wholesalePrice.
// Сопоставление: по SKU, потом по ключу (первое слово названия + объём).
// Запуск: cd server && node tools/set-wholesale.mjs [путь-к-price-items.json] [--apply]
import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'
import { readFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()
const items = JSON.parse(readFileSync(process.argv[2] || '/tmp/claude-0/-home-user-project-simba/1749002d-5615-562f-864f-d89af882543c/scratchpad/price-items.json', 'utf8'))

// Кириллические двойники внутри латинских названий
const HOMOGLYPH = { А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X', а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x' }
const deHomoglyph = (s) => (s || '').replace(/[АВЕКМНОРСТХаеорсух]/g, (c) => HOMOGLYPH[c] || c)
const latin = (s) => deHomoglyph(s).match(/[A-Za-z0-9+]{3,}/g)?.[0]?.toLowerCase() || ''
const volNum = (s) => {
  const m = String(s || '').match(/([\d.,]+)/)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

// Ключ: первое латинское слово + объём
const byKey = new Map()
const bySku = new Map()
for (const it of items) {
  if (!it.art) continue
  if (it.art) bySku.set(it.art, it)
  const k = `${latin(it.name)}|${volNum(it.vol)}`
  if (!byKey.has(k)) byKey.set(k, it)
}

const variants = await prisma.productVariant.findMany({
  where: { deletedAt: null },
  include: { product: { select: { name: true } } },
})

let matched = 0
const ambiguous = []
const rrcDifferences = []

for (const v of variants) {
  let hit = null
  // Сначала по SKU
  if (v.sku) {
    hit = bySku.get(v.sku)
  }
  // Потом по ключу
  if (!hit) {
    const k = `${latin(v.product.name)}|${Number(v.volumeValue)}`
    hit = byKey.get(k)
  }

  if (!hit) {
    ambiguous.push(v.product.name.slice(0, 44))
    continue
  }

  // Проверка РРЦ
  if (hit.rrc && v.retailPrice) {
    const expectedRrc = hit.rrc * 100
    if (Math.abs(v.retailPrice - expectedRrc) > 100) {
      rrcDifferences.push(`${v.product.name.slice(0, 40)}: база ${v.retailPrice / 100} ₽, прайс ${expectedRrc / 100} ₽`)
    }
  }

  if (APPLY) {
    const wholesalePrice = hit.opt * 100
    if (v.wholesalePrice !== wholesalePrice) {
      await prisma.productVariant.update({
        where: { id: v.id },
        data: { wholesalePrice }
      })
    }
  }
  matched++
}

console.log(`${APPLY ? 'проставлено' : 'сопоставлено (пробный прогон)'}: ${matched} из ${variants.length}`)
console.log(`без сопоставления: ${ambiguous.length}`)
if (ambiguous.length) console.log('  ' + ambiguous.slice(0, 12).join('\n  '))
console.log(`расхождения РРЦ: ${rrcDifferences.length}`)
if (rrcDifferences.length) console.log('  ' + rrcDifferences.slice(0, 8).join('\n  '))
if (!APPLY) console.log('\nЗапусти с --apply, чтобы записать.')
await prisma.$disconnect()
