// Проставляет артикулы поставщика (BeautyMedGroup) в ProductVariant.sku.
// Сопоставление: латинская часть названия + объём. Неоднозначные — пропускаются.
// Артикул делает будущие обновления цен и обмен с 1С надёжными: сверка идёт
// по номеру, а не по написанию названия (в каталоге встречаются опечатки).
// Запуск: cd server && node tools/assign-sku.mjs [--apply]
import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'
import { readFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()
const items = JSON.parse(readFileSync(process.argv[2] || '/tmp/claude-0/-home-user-project-simba/1749002d-5615-562f-864f-d89af882543c/scratchpad/price-items.json', 'utf8'))

// В каталоге встречаются кириллические буквы-двойники внутри латинских
// названий («ВEEVENOM», «REDENSIFICANTЕ») — приводим их к латинице.
const HOMOGLYPH = { А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X', а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x' }
const deHomoglyph = (s) => (s || '').replace(/[АВЕКМНОРСТХаеорсух]/g, (c) => HOMOGLYPH[c] || c)
// Ключ — первое латинское слово: оно уникально опознаёт продукт,
// а второе слово в каталоге и прайсе часто расходится.
const latin = (s) => deHomoglyph(s).match(/[A-Za-z0-9+]{3,}/g)?.[0]?.toLowerCase() || ''
const volNum = (s) => {
  const m = String(s || '').match(/([\d.,]+)/)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

// В прайсе одно название может иметь несколько фасовок — ключ «имя+объём».
const byKey = new Map()
for (const it of items) {
  if (!it.art || !it.rrc) continue
  const k = `${latin(it.name)}|${volNum(it.vol)}`
  if (!byKey.has(k)) byKey.set(k, it)
}

const variants = await prisma.productVariant.findMany({
  where: { deletedAt: null },
  include: { product: { select: { name: true, slug: true } } },
})

let matched = 0
const ambiguous = []
for (const v of variants) {
  const k = `${latin(v.product.name)}|${Number(v.volumeValue)}`
  const hit = byKey.get(k)
  if (!hit) {
    ambiguous.push(v.product.name.slice(0, 44))
    continue
  }
  if (APPLY && v.sku !== hit.art) {
    // sku @unique — конфликт пропускаем, а не роняем прогон.
    try {
      await prisma.productVariant.update({ where: { id: v.id }, data: { sku: hit.art } })
    } catch (e) {
      ambiguous.push(`${v.product.name.slice(0, 40)} (артикул ${hit.art} занят)`)
      continue
    }
  }
  matched++
}

console.log(`${APPLY ? 'проставлено' : 'сопоставлено (пробный прогон)'}: ${matched} из ${variants.length}`)
console.log(`без артикула: ${ambiguous.length}`)
if (ambiguous.length) console.log('  ' + ambiguous.slice(0, 12).join('\n  '))
if (!APPLY) console.log('\nЗапусти с --apply, чтобы записать.')
await prisma.$disconnect()
