/**
 * Точечная установка вида животного для товаров по id.
 *
 * Использование:
 *   npx tsx --env-file=.env src/scripts/set-species.ts cat=id1,id2 dog=id3 [--apply]
 *
 * По умолчанию — сухой прогон (предпросмотр). Используйте --apply для записи.
 * Из вывода можно собрать обратную команду для отката.
 */

import { PrismaClient, type ProductSpecies } from '@prisma/client'
import { withSpeciesTag } from '../lib/quiz-tags.js'

const prisma = new PrismaClient()

type UpdatePlan = {
  productId: string
  species: ProductSpecies
  newSpecies: ProductSpecies
  name: string
}

type ParsedArgs = {
  updates: Map<string, ProductSpecies>
  apply: boolean
}

/**
 * Разбирает argv в Map<id, species>. При неверном аргументе бросает —
 * решение «что делать с ошибкой» остаётся за вызывающим, парсер процесс не валит.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const updates = new Map<string, ProductSpecies>()
  const validSpecies = ['cat', 'dog', 'both', 'unknown']
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  for (const arg of argv) {
    if (arg === '--apply') continue
    if (!arg.includes('=')) continue

    const [species, idsList] = arg.split('=')
    if (!validSpecies.includes(species)) {
      throw new Error(`Неизвестный вид: ${species}. Допустимые: ${validSpecies.join(', ')}`)
    }

    for (const id of idsList.split(',')) {
      const trimmed = id.trim()
      if (!uuidPattern.test(trimmed)) {
        throw new Error(`Неверный UUID: ${trimmed}`)
      }

      // Проверка дубликатов в разных видах
      if (updates.has(trimmed) && updates.get(trimmed) !== species) {
        throw new Error(`ID ${trimmed} уже указан для ${updates.get(trimmed)}, а теперь для ${species}`)
      }

      updates.set(trimmed, species as ProductSpecies)
    }
  }

  const apply = argv.includes('--apply')
  return { updates, apply }
}

async function main() {
  let parsed
  try {
    parsed = parseArgs(process.argv.slice(2))
  } catch (err) {
    console.error(`❌ ${err instanceof Error ? err.message : err}`)
    process.exit(2)
  }
  const { updates, apply } = parsed

  if (updates.size === 0) {
    console.log('Использование: npx tsx src/scripts/set-species.ts cat=<id>,<id> dog=<id> [--apply]')
    console.log('Пример: npx tsx src/scripts/set-species.ts cat=123e4567-e89b-12d3-a456-426614174000 --apply')
    return
  }

  console.log('\n════════════════════════════════════════════════════════════════════')
  console.log('  Установка вида животного для товаров')
  console.log('════════════════════════════════════════════════════════════════════')
  console.log(`Режим: ${apply ? '✅ ПРИМЕНЕНИЕ' : '📋 ПРЕДПРОСМОТР (без записи)'}\n`)

  const plan: UpdatePlan[] = []
  const notFound: string[] = []
  const unchanged: string[] = []
  let alreadySet = 0

  // Загружаем товары
  const productIds = Array.from(updates.keys())
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, species: true, quizTags: true },
  })

  const productsById = new Map(products.map((p) => [p.id, p]))

  // Планируем изменения
  for (const [id, newSpecies] of updates) {
    const product = productsById.get(id)
    if (!product) {
      notFound.push(id)
      continue
    }

    if (product.species === newSpecies) {
      alreadySet++
      unchanged.push(`  ${product.species.padEnd(8)} (без изменений)  ·  ${product.name}`)
      continue
    }

    plan.push({
      productId: id,
      species: product.species,
      newSpecies,
      name: product.name,
    })
  }

  // Выводим план изменений
  if (plan.length > 0) {
    console.log(`📝 БУДЕТ ИЗМЕНЕНО (${plan.length}):\n`)
    for (const upd of plan) {
      const arrow = `${upd.species.padEnd(8)} → ${upd.newSpecies.padEnd(8)}`
      console.log(`  ${arrow}  ·  ${upd.name}  ·  id: ${upd.productId}`)
    }
    console.log()
  }

  if (unchanged.length > 0) {
    console.log(`ℹ️  УЖЕ СТОИТ ЭТОТ ВИД (${unchanged.length}):`)
    for (const line of unchanged) console.log(line)
    console.log()
  }

  // Выводим не найденные
  if (notFound.length > 0) {
    console.log(`❌ НЕ НАЙДЕНЫ (${notFound.length}):`)
    for (const id of notFound) {
      console.log(`  ${id}`)
    }
    console.log()
  }

  // Откат печатаем и до записи, и после: после он нужнее — прежние значения
  // больше нигде не сохранены.
  if (plan.length > 0) {
    const byOldSpecies = new Map<string, string[]>()
    for (const upd of plan) {
      const ids = byOldSpecies.get(upd.species) ?? []
      ids.push(upd.productId)
      byOldSpecies.set(upd.species, ids)
    }
    const rollbackCmd = Array.from(byOldSpecies.entries())
      .map(([species, ids]) => `${species}=${ids.join(',')}`)
      .join(' ')
    console.log('🔄 ОТКАТ (вернёт прежние виды):')
    console.log(`  npx tsx --env-file=.env src/scripts/set-species.ts ${rollbackCmd} --apply\n`)
  }

  if (!apply) {
    console.log('📌 Это предпросмотр. Ничего не записано в базу. Для применения запустите с флагом --apply\n')
    return
  }

  // Применяем изменения
  console.log('\n⏳ Применяем изменения в базу...\n')
  let updated = 0
  for (const upd of plan) {
    const product = productsById.get(upd.productId)!
    const newQuizTags = withSpeciesTag(product.quizTags, upd.newSpecies)

    await prisma.product.update({
      where: { id: upd.productId },
      data: { species: upd.newSpecies, quizTags: newQuizTags },
    })
    updated++
  }

  console.log(`✅ Обновлено: ${updated} товаров`)
  console.log(`ℹ️  Уже имели этот вид: ${alreadySet}`)
  console.log(`❌ Не найдено: ${notFound.length}\n`)
}

main()
  .catch((err) => {
    console.error('❌ Ошибка:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
