import { PrismaClient } from '@prisma/client'
import { isNonProductRow } from '../services/product-import'

// Разовая чистка: складские позиции (коробки, скотч, стеллаж, БРАК), которые
// попали в каталог до появления фильтра в импорте.
// По умолчанию только показывает список. Удаляет с флагом --apply.

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      isActive: true,
      _count: { select: { orderItems: true, variants: true } },
    },
  })

  const found = products.filter(p => isNonProductRow(p.name))

  if (found.length === 0) {
    console.log('Складских позиций в каталоге не найдено.')
    return
  }

  // Товар, который когда-то заказывали, удалять нельзя — история заказов ссылается на него.
  const deletable = found.filter(p => p._count.orderItems === 0)
  const ordered = found.filter(p => p._count.orderItems > 0)

  console.log(`Найдено складских позиций: ${found.length}`)
  for (const p of found) {
    const mark = p._count.orderItems > 0 ? 'БЫЛ В ЗАКАЗАХ — только скрыть' : 'можно удалить'
    console.log(`  • ${p.name}  [${mark}, фасовок: ${p._count.variants}]`)
  }

  if (!apply) {
    console.log('\nЭто предварительный просмотр. Ничего не изменено.')
    console.log('Для удаления запустите ту же команду с флагом --apply')
    return
  }

  for (const p of ordered) {
    await prisma.product.update({ where: { id: p.id }, data: { isActive: false } })
  }

  const deleted = await prisma.product.deleteMany({
    where: { id: { in: deletable.map(p => p.id) } },
  })

  console.log(`\nУдалено: ${deleted.count}`)
  console.log(`Скрыто (были в заказах): ${ordered.length}`)
}

main()
  .catch(e => {
    console.error('Ошибка:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
