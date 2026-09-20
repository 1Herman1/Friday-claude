import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/** Ключ для поиска дублей: «Hill's» и «Hill s» должны схлопнуться в одно. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]/g, '')
}

async function main() {
  const apply = process.argv.includes('--apply')

  const brands = await prisma.brand.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      description: true,
      _count: { select: { products: true } },
    },
    orderBy: { name: 'asc' },
  })

  const groups = new Map<string, typeof brands>()
  for (const brand of brands) {
    const key = normalizeName(brand.name)
    groups.set(key, [...(groups.get(key) ?? []), brand])
  }

  const duplicates = [...groups.values()].filter((g) => g.length > 1)

  console.log('\n════════ ДУБЛИ БРЕНДОВ ════════')
  console.log(`Режим: ${apply ? 'ПРИМЕНЕНИЕ' : 'предпросмотр (без записи)'}`)
  console.log(`\nВсего брендов:   ${brands.length}`)
  console.log(`Групп с дублями: ${duplicates.length}`)

  if (duplicates.length === 0) {
    console.log('\n✅ Дублей нет.\n')
    return
  }

  const plan: Array<{ keep: (typeof brands)[number]; drop: typeof brands }> = []

  for (const group of duplicates) {
    // Оставляем того, у кого больше товаров: меньше строк переносить, и slug
    // такого бренда уже разошёлся по ссылкам и поисковой выдаче.
    const sorted = [...group].sort((a, b) => b._count.products - a._count.products)
    const [keep, ...drop] = sorted
    plan.push({ keep, drop })

    console.log(`\n«${keep.name}»`)
    console.log(`  ОСТАВЛЯЕМ  ${keep.slug.padEnd(14)} товаров: ${keep._count.products}`)
    for (const d of drop) {
      console.log(`  переносим  ${d.slug.padEnd(14)} товаров: ${d._count.products}`)
    }
  }

  const moved = plan.reduce((sum, p) => sum + p.drop.reduce((s, d) => s + d._count.products, 0), 0)
  console.log(`\nБудет перенесено товаров: ${moved}`)
  console.log(`Будет удалено брендов:    ${plan.reduce((s, p) => s + p.drop.length, 0)}`)

  if (!apply) {
    console.log('\n📌 Предпросмотр. Ничего не изменено. Для применения — флаг --apply\n')
    return
  }

  for (const { keep, drop } of plan) {
    await prisma.$transaction(async (tx) => {
      for (const d of drop) {
        await tx.product.updateMany({ where: { brandId: d.id }, data: { brandId: keep.id } })
        // Логотип и описание не теряем: если у победителя пусто, забираем у дубля.
        if (!keep.logo && d.logo) {
          await tx.brand.update({ where: { id: keep.id }, data: { logo: d.logo } })
        }
        if (!keep.description && d.description) {
          await tx.brand.update({ where: { id: keep.id }, data: { description: d.description } })
        }
        await tx.brand.delete({ where: { id: d.id } })
      }
    })
    console.log(`✅ «${keep.name}» — слито в ${keep.slug}`)
  }

  console.log('\nГотово.\n')
}

main()
  .catch((err) => {
    console.error('❌', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
