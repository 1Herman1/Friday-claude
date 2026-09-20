// Ручное сопоставление позиций, у которых название на сайте расходится с
// прайсом BeautyMedGroup (перевод названия или ошибка объёма в каталоге).
// Каждая пара подтверждена точным совпадением РРЦ или буквальным переводом.
// Запуск: cd server && node --env-file=.env tools/map-sku-manual.mjs [--apply]
import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()

// namePrefix → { sku, rrc (₽), opt (₽), volume?: [value, unit] }
const MAP = [
  { prefix: 'KORPO SLIM GEL', sku: '2050', rrc: 7146, opt: 3761 },
  { prefix: 'NUTRIESTIMUL', sku: '2039', rrc: 14200, opt: 7900 },
  { prefix: 'OXIODERM', sku: '10075', rrc: 5000, opt: 2800, volume: [3, 'pcs'] },
  { prefix: 'REGENERATIVO CELLULAR', sku: '2040', rrc: 13100, opt: 7300, volume: [30, 'ml'] },
  { prefix: 'ROSE HIP OIL', sku: '2133', rrc: 6100, opt: 3400 },
  { prefix: 'SENITUL', sku: '10074', rrc: 5100, opt: 2800, volume: [3, 'pcs'] },
  { prefix: 'NATURAL CLEANSING MILK', sku: '2082', rrc: 6700, opt: 3700 },
]

for (const m of MAP) {
  const v = await prisma.productVariant.findFirst({
    where: { deletedAt: null, product: { name: { startsWith: m.prefix }, deletedAt: null } },
    include: { product: { select: { id: true, name: true } } },
  })
  if (!v) { console.log(`[нет] ${m.prefix}`); continue }
  const data = { sku: m.sku, retailPrice: m.rrc * 100, wholesalePrice: m.opt * 100 }
  if (m.volume) Object.assign(data, { volumeValue: m.volume[0], volumeUnit: m.volume[1], volumeLabel: null })
  console.log(`${APPLY ? 'записано' : 'план'}: ${v.product.name.slice(0, 40)} → sku ${m.sku}, ${v.retailPrice / 100} → ${m.rrc} ₽, опт ${m.opt} ₽`)
  if (APPLY) {
    await prisma.productVariant.update({ where: { id: v.id }, data })
    await prisma.$executeRaw`UPDATE products p SET "minPrice" = s.min_p, "maxPrice" = s.max_p
      FROM (SELECT MIN("retailPrice") min_p, MAX("retailPrice") max_p FROM product_variants
            WHERE "productId" = ${v.product.id} AND "isActive" AND "deletedAt" IS NULL) s
      WHERE p.id = ${v.product.id}`
  }
}
await prisma.$disconnect()
