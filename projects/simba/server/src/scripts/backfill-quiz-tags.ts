import { PrismaClient } from '@prisma/client'
import { deriveQuizTags, type AutotagInput } from '../services/quiz-autotag.js'

const prisma = new PrismaClient()
const BATCH_SIZE = 200

type Row = {
  id: string
  name: string
  quizTags: string[]
  autoQuizTags: string[]
  derived: string[]
  hasCategory: boolean
}

function countByPrefix(rows: Row[], prefix: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    for (const tag of row.derived) {
      if (!tag.startsWith(prefix)) continue
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return new Map([...counts.entries()].sort((a, b) => b[1] - a[1]))
}

function printDistribution(title: string, counts: Map<string, number>) {
  console.log(`\n--- ${title} ---`)
  if (counts.size === 0) {
    console.log('  (пусто)')
    return
  }
  for (const [tag, count] of counts) {
    console.log(`  ${tag.padEnd(26)} ${count}`)
  }
}

async function main() {
  const apply = process.argv.includes('--apply')

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      quizTags: true,
      autoQuizTags: true,
      categories: { select: { category: { select: { slug: true } } } },
      filterValues: {
        select: { filterValue: { select: { value: true, filter: { select: { name: true } } } } },
      },
    },
  })

  const rows: Row[] = products.map((p) => {
    const input: AutotagInput = {
      name: p.name,
      categorySlugs: p.categories.map((c) => c.category.slug),
      filters: p.filterValues.map((fv) => ({
        filter: fv.filterValue.filter.name,
        value: fv.filterValue.value,
      })),
    }
    return {
      id: p.id,
      name: p.name,
      quizTags: p.quizTags,
      autoQuizTags: p.autoQuizTags,
      derived: deriveQuizTags(input),
      hasCategory: p.categories.length > 0,
    }
  })

  const tagged = rows.filter((r) => r.derived.length > 0)
  const untagged = rows.filter((r) => r.derived.length === 0)
  const changed = tagged.filter(
    (r) => JSON.stringify(r.derived) !== JSON.stringify(r.autoQuizTags)
  )
  const manuallyTagged = rows.filter((r) => r.quizTags.length > 0)

  console.log('\n════════ АВТО-ТЕГИ ДЛЯ КВИЗА ════════')
  console.log(`Режим: ${apply ? 'ПРИМЕНЕНИЕ' : 'предпросмотр (без записи)'}`)
  console.log(`\nАктивных товаров:                  ${rows.length}`)
  console.log(`Получат авто-теги:                 ${tagged.length}`)
  console.log(`Останутся вне квиза (нет вида):    ${untagged.length}`)
  console.log(`Изменится записей:                 ${changed.length}`)
  console.log(`С ручными тегами (не затрагиваем): ${manuallyTagged.length}`)

  const coverageBefore = manuallyTagged.length
  const coverageAfter = new Set([...manuallyTagged.map((r) => r.id), ...tagged.map((r) => r.id)]).size
  console.log(`\nОхват квиза: ${coverageBefore} → ${coverageAfter} товаров`)

  printDistribution('Вид животного', countByPrefix(rows, 'species:'))
  printDistribution('Возраст', countByPrefix(rows, 'age:'))
  printDistribution('Формат', countByPrefix(rows, 'format:'))
  printDistribution('Размер породы', countByPrefix(rows, 'size:'))
  printDistribution('Здоровье', countByPrefix(rows, 'health:'))
  printDistribution('Аллергены в составе', countByPrefix(rows, 'contains:'))

  // Товары без категорий: вид взят только из названия — самое рискованное место,
  // поэтому печатаем выборку для глазной проверки.
  const byNameOnly = tagged.filter((r) => !r.hasCategory)
  if (byNameOnly.length > 0) {
    console.log(`\n--- Вид определён только по названию (${byNameOnly.length}), первые 30 ---`)
    for (const row of byNameOnly.slice(0, 30)) {
      const species = row.derived.find((t) => t.startsWith('species:')) ?? '?'
      console.log(`  ${species.replace('species:', '').padEnd(4)} ${row.name.slice(0, 68)}`)
    }
  }

  if (untagged.length > 0) {
    console.log(`\n--- Без вида животного (${untagged.length}), первые 10 ---`)
    for (const row of untagged.slice(0, 10)) {
      console.log(`  • ${row.name.slice(0, 70)}`)
    }
  }

  if (!apply) {
    console.log('\n📌 Предпросмотр. Ничего не записано. Для применения — флаг --apply\n')
    return
  }

  if (changed.length === 0) {
    console.log('\n✅ Всё уже актуально, записывать нечего.\n')
    return
  }

  for (let i = 0; i < changed.length; i += BATCH_SIZE) {
    const batch = changed.slice(i, i + BATCH_SIZE)
    await prisma.$transaction(
      batch.map((row) =>
        prisma.product.update({ where: { id: row.id }, data: { autoQuizTags: row.derived } })
      )
    )
  }

  console.log(`\n✅ Записано авто-тегов: ${changed.length} товаров.`)
  console.log('   Ручные quizTags не тронуты — они приоритетнее при подборе.\n')
}

main()
  .catch((err) => {
    console.error('❌', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
