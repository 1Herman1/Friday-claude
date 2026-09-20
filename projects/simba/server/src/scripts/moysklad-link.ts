/**
 * Скрипт этап 2: привязка вариантов товаров к позициям МойСклада по UUID.
 *
 * Сухой запуск (по умолчанию):
 *   npx tsx server/src/scripts/moysklad-link.ts
 *
 * С применением:
 *   npx tsx server/src/scripts/moysklad-link.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { fetchAssortment } from '../services/moysklad/client.js'
import { matchVariants, type VariantForSync } from '../services/moysklad/plan.js'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

async function main() {
  try {
    console.log('📡 Получаю данные из МойСклада...\n')

    const msItems = await fetchAssortment()

    console.log('📚 Получаю варианты товаров из БД...\n')

    const ourVariants = await prisma.productVariant.findMany({
      select: {
        id: true,
        productId: true,
        sku: true,
        moyskladId: true,
        price: true,
        stock: true,
        product: { select: { name: true } },
      },
    })

    const variantsForSync: VariantForSync[] = ourVariants.map((v) => ({
      id: v.id,
      sku: v.sku,
      moyskladId: v.moyskladId,
      price: v.price,
      stock: v.stock,
      productId: v.productId,
    }))

    console.log('🔗 Матчу варианты...\n')

    const matchResult = matchVariants(variantsForSync, msItems)

    // ─── ВЫВОД ────────────────────────────────────────────────────────────

    console.log('='.repeat(80))
    console.log('РЕЗУЛЬТАТЫ МАТЧИНГА\n')

    const alreadyLinked = ourVariants.filter((v) => v.moyskladId).length
    console.log(`Наших вариантов: ${ourVariants.length}`)
    console.log(`  Уже привязано: ${alreadyLinked}`)
    console.log(`  Новых привязок: ${matchResult.links.filter((l) => !ourVariants.find((v) => v.moyskladId === l.moyskladId)).length}`)
    console.log(`  Не найдены в МС: ${matchResult.unmatchedOurs.length}`)

    if (matchResult.ambiguous.length > 0) {
      console.log(`\n⚠️  НЕОДНОЗНАЧНЫЕ АРТИКУЛЫ (один артикул → несколько позиций МС):`)
      matchResult.ambiguous.slice(0, 10).forEach(({ key, names }) => {
        console.log(`  "${key}":`)
        names.forEach((name) => {
          console.log(`    - ${name}`)
        })
      })
      if (matchResult.ambiguous.length > 10) {
        console.log(`  ... и ещё ${matchResult.ambiguous.length - 10}`)
      }
    }

    if (matchResult.unmatchedOurs.length > 0) {
      console.log(`\n❌ НАШИ ВАРИАНТЫ БЕЗ ПАРЫ В МОЙСЛАДЕ (первые 20):`)
      matchResult.unmatchedOurs.slice(0, 20).forEach((v) => {
        const ourVariant = ourVariants.find((ov) => ov.id === v.id)
        console.log(`  ${v.sku || '(без SKU)'} | ${ourVariant?.product.name}`)
      })
      if (matchResult.unmatchedOurs.length > 20) {
        console.log(`  ... и ещё ${matchResult.unmatchedOurs.length - 20}`)
      }
    }

    if (matchResult.onlyInMs.length > 0) {
      console.log(`\n🔹 ПОЗИЦИИ МОЙСКЛАДА БЕЗ ПАРЫ (первые 20):`)
      matchResult.onlyInMs.slice(0, 20).forEach((item) => {
        console.log(`  ${item.article || item.code || '(без кода)'} | ${item.name}`)
      })
      if (matchResult.onlyInMs.length > 20) {
        console.log(`  ... и ещё ${matchResult.onlyInMs.length - 20}`)
      }
    }

    console.log('\n' + '='.repeat(80))

    if (!apply) {
      console.log('\n✅ СУХОЙ ЗАПУСК — ничего не записано.\n')
      console.log(`Запустите с флагом --apply чтобы применить привязки:\n`)
      console.log(`  npx tsx server/src/scripts/moysklad-link.ts --apply\n`)
      return
    }

    // ─── ПРИМЕНЕНИЕ ───────────────────────────────────────────────────────

    console.log('\n💾 Применяю привязки...\n')

    const newLinks = matchResult.links.filter((l) => !ourVariants.find((v) => v.moyskladId === l.moyskladId))

    for (const link of newLinks) {
      await prisma.productVariant.update({
        where: { id: link.variantId },
        data: { moyskladId: link.moyskladId },
      })
    }

    console.log(`✅ Записано новых привязок: ${newLinks.length}`)
    console.log(`✅ Уже привязано: ${alreadyLinked}`)
    console.log(`⚠️  Не найдены в МС: ${matchResult.unmatchedOurs.length}\n`)
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Ошибка:', error.message)
    } else {
      console.error('❌ Ошибка:', error)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
