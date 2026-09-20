import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CATEGORY = { slug: 'care', name: 'Ветаптека и уход' }

/** Слова, по которым товар опознаётся как уход или ветпрепарат, а не корм. */
const CARE_WORDS = [
  'шампунь',
  'лосьон',
  'крем',
  'гель-мыло',
  'зубная паста',
  'паста для вывода шерсти',
  'спрей',
  'нейтрализатор запаха',
  'антипаразит',
  'салфетк',
  'капли',
  'витамин',
]

function isCare(name: string): boolean {
  const lower = name.toLowerCase().replace(/ё/g, 'е')
  return CARE_WORDS.some((w) => lower.includes(w))
}

async function main() {
  const apply = process.argv.includes('--apply')

  const products = await prisma.product.findMany({
    where: { isActive: true, categories: { none: {} } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const matched = products.filter((p) => isCare(p.name))
  const rest = products.filter((p) => !isCare(p.name))

  console.log('\n════════ ВЕТАПТЕКА И УХОД ════════')
  console.log(`Режим: ${apply ? 'ПРИМЕНЕНИЕ' : 'предпросмотр (без записи)'}`)
  console.log(`\nБез категории:        ${products.length}`)
  console.log(`Опознано как уход:    ${matched.length}`)
  console.log(`Останется без раздела: ${rest.length}`)

  console.log('\n--- Пойдут в «Ветаптеку и уход» ---')
  for (const p of matched) console.log(`  • ${p.name.slice(0, 70)}`)

  console.log('\n--- Останутся без раздела (это корма, им нужен вид животного) ---')
  for (const p of rest.slice(0, 20)) console.log(`  • ${p.name.slice(0, 70)}`)

  if (!apply) {
    console.log('\n📌 Предпросмотр. Ничего не записано. Для применения — флаг --apply\n')
    return
  }

  const category = await prisma.category.upsert({
    where: { slug: CATEGORY.slug },
    update: {},
    create: { slug: CATEGORY.slug, name: CATEGORY.name },
    select: { id: true },
  })

  await prisma.productCategory.createMany({
    data: matched.map((p) => ({ productId: p.id, categoryId: category.id })),
    skipDuplicates: true,
  })

  console.log(`\n✅ Категория «${CATEGORY.name}» готова, товаров в ней: ${matched.length}.\n`)
}

main()
  .catch((err) => {
    console.error('❌', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
