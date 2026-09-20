// Проставляет isProfessional=true для фасовок с конкретными SKU.
// Идемпотентно: повторный запуск не вызывает обновлений.
// Запуск: cd server && node tools/set-pro-variants.mjs [--apply]
import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()

// Четыре профессиональные фасовки
const PRO_SKUS = ['2020', '2021', '2024', '10071']

const variants = await prisma.productVariant.findMany({
  where: { deletedAt: null },
  include: { product: { select: { name: true } } },
})

let updated = 0
const processed = []

for (const v of variants) {
  if (!v.sku || !PRO_SKUS.includes(v.sku)) {
    continue
  }

  if (v.isProfessional) {
    // Уже профессиональный
    processed.push(`${v.product.name.slice(0, 50)} (${v.sku}): уже профи`)
    continue
  }

  if (APPLY) {
    await prisma.productVariant.update({
      where: { id: v.id },
      data: { isProfessional: true }
    })
    updated++
  }
  processed.push(`${v.product.name.slice(0, 50)} (${v.sku}): ${APPLY ? 'установлено' : 'будет установлено'}`)
}

console.log(`\n${APPLY ? 'Обновлено' : 'Обнаружено'}: ${updated} фасовок`)
console.log(`Обработано всего: ${processed.length}`)
if (processed.length) {
  console.log('\nДетали:')
  processed.forEach(p => console.log('  ' + p))
}

if (!APPLY) {
  console.log('\nЗапусти с --apply, чтобы записать.')
}

await prisma.$disconnect()
