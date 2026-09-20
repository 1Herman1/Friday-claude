import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Точечная разметка вида для товаров, где deriveQuizTags() не может определить
// его ни по категории, ни по названию (бренд/линейка не содержит "кошек"/"собак").
// Вид проставлен вручную только там, где однозначно известен по построению
// линейки бренда — остальные товары без вида умышленно не тронуты, гадать
// на лечебных кормах опасно (Hill's c/d Multicare/t/d Dental/Metabolic
// существуют под одинаковым названием и для кошек, и для собак).
const SPECIES: Record<string, 'cat' | 'dog'> = {
  // Hill's Science Plan Adult — размер фасовки видоспецифичен: 10кг/14кг = собаки,
  // 1.5кг = кошки (собачьи пачки Science Plan Adult начинаются от 2.5кг).
  'ba125385-ec67-4a4d-b2da-b40d351fe3a1': 'dog', // Hill's Science Plan Adult (ягненок) - 10 кг
  'c07fc84b-bc4d-4d6c-8994-1969679e09a1': 'cat', // Hill's Science Plan Adult (тунец) - 1,5 кг
  '79c6a09c-db6b-444a-8d65-e9fd503cb4a8': 'cat', // Hill's Science Plan Adult (курица) - 1,5 кг
  // Performance Adult — линейка Hill's только для активных/рабочих собак.
  '472e9b8d-30ee-4aa4-9fcc-99b0da57313c': 'dog', // Hill's Science Plan Performance Adult (курица)
  // Prescription Diet: m/d, s/d — только кошки; j/d — только собаки (видоспецифичные коды линеек).
  'af3c7afc-bb5f-4e14-abc4-e8f1adaf4afa': 'cat', // Hill's Prescription Diet m/d Diabetes (курица)
  '5550b7f5-e3fe-4648-8c37-fd7bbe03bbc6': 'cat', // Hill's Prescription Diet s/d Urinary Care (курица)
  '557d5880-bb59-4326-9e55-a19b7e9f5f47': 'dog', // Hill's Prescription Diet j/d Joint Care (курица)
  // ZILLII — бренд кормов только для кошек.
  '8bc20909-f0ef-481f-b2d5-8847ac177e7b': 'cat', // ZILLII Healty Care Skin & Coat Care Лосось (влажный)
  '55c4d6d3-2b75-47c8-b0c6-fa38ee0ef333': 'cat', // ZILLII Hairball Control (Индейка с уткой)
  '4742504f-f935-4540-b05c-e41da50e79df': 'cat', // ZILLII Skin & Coat Care (Индейка с ягненком)
  '32e40285-9d99-4948-bd01-08db52d7bb8a': 'cat', // ZILLII Healty Care Sensitive Digestion Индейка (влажный)
}

async function main() {
  const apply = process.argv.includes('--apply')
  const ids = Object.keys(SPECIES)

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, quizTags: true },
  })

  console.log(`\n════════ Точечная разметка вида (${products.length}/${ids.length} найдено) ════════`)
  console.log(`Режим: ${apply ? 'ПРИМЕНЕНИЕ' : 'предпросмотр (без записи)'}\n`)

  for (const p of products) {
    const species = SPECIES[p.id]
    const tag = `species:${species}`
    const already = p.quizTags.includes(tag)
    console.log(`  ${already ? '=' : '+'} ${species.padEnd(4)} ${p.name.slice(0, 68)}`)
  }

  const missing = ids.filter((id) => !products.some((p) => p.id === id))
  if (missing.length > 0) {
    console.log(`\n⚠️  Не найдено в БД (id): ${missing.join(', ')}`)
  }

  if (!apply) {
    console.log('\n📌 Предпросмотр. Ничего не записано. Для применения — флаг --apply\n')
    return
  }

  for (const p of products) {
    const tag = `species:${SPECIES[p.id]}`
    if (p.quizTags.includes(tag)) continue
    await prisma.product.update({
      where: { id: p.id },
      data: { quizTags: { push: tag } },
    })
  }

  console.log(`\n✅ Проставлен вид для ${products.length} товаров.\n`)
}

main()
  .catch((err) => {
    console.error('❌', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
