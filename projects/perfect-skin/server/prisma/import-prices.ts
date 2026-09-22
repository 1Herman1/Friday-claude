import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { recalcProductPrices } from '../src/services/product-prices.js'
import { matchProduct } from '../src/lib/import-prices.match.js'
import { planVariantUpdate } from '../src/lib/import-prices.plan.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface PriceImportItem {
  name: string
  volume: string
  wholesaleKopecks: number
  retailKopecks: number | null
  isProfessional: boolean
  siteName?: string
  forceSingleVariant?: boolean
  skip?: string
}

interface PriceImportData {
  _meta: {
    source: string
    date: string
    note?: string
  }
  items: PriceImportItem[]
}

interface MatchResult {
  product: { id: string; name: string }
  variant: { id: string; volumeLabel: string }
  item: PriceImportItem
  changes: {
    wholesalePrice: { old: number | null; new: number }
    isProfessional: { old: boolean; new: boolean }
    retailPriceMismatch?: { old: number; new: number }
  }
}

async function main() {
  const prisma = new PrismaClient()

  // Парсинг аргументов CLI
  const args = process.argv.slice(2)
  let filePath = path.join(__dirname, '../assets/price-import.json')
  let isApply = false
  let applyRetail = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      filePath = args[i + 1]
      i++
    } else if (args[i] === '--apply') {
      isApply = true
    } else if (args[i] === '--apply-retail') {
      applyRetail = true
    }
  }

  // Валидация: --apply-retail допустим только с --apply
  if (applyRetail && !isApply) {
    console.error('❌ Ошибка: флаг --apply-retail допустим только вместе с --apply')
    process.exit(1)
  }

  try {
    // Чтение и валидация JSON
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Файл не найден: ${filePath}`)
      process.exit(1)
    }

    let importData: PriceImportData
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      importData = JSON.parse(content)
    } catch (e) {
      console.error(`❌ Невалидный JSON: ${filePath}`)
      console.error(e instanceof Error ? e.message : String(e))
      process.exit(1)
    }

    if (!importData.items || !Array.isArray(importData.items)) {
      console.error('❌ JSON должен содержать поле items (массив)')
      process.exit(1)
    }

    console.log(`📦 Загружено ${importData.items.length} записей из ${filePath}\n`)

    // Загрузка существующих товаров
    const products = await prisma.product.findMany({
      include: {
        variants: {
          where: { isActive: true, deletedAt: null },
        },
      },
      where: { isActive: true, deletedAt: null },
    })

    const matches: MatchResult[] = []
    const unmatched: { item: PriceImportItem; reason: string }[] = []
    const ambiguous: { item: PriceImportItem; candidates: string[] }[] = []
    const skipped: { item: PriceImportItem; reason: string }[] = []
    const conflicts: { item: PriceImportItem; reason: string }[] = []
    const retailMismatches: { product: string; variant: string; item: PriceImportItem; old: number; new: number }[] = []
    const retailUpdates: { product: string; variant: string; old: number; new: number }[] = []

    // Отслеживание фасовок для обнаружения конфликтов
    const variantMatches = new Map<string, { itemIndex: number; productId: string; variantId: string }>()

    // Преобразовать товары в формат для matchProduct
    const simplifiedProducts = products.map((p) => ({
      id: p.id,
      name: p.name,
      variants: p.variants.map((v) => ({
        id: v.id,
        volumeValue: v.volumeValue ? (typeof v.volumeValue === 'number' ? v.volumeValue : (v.volumeValue as any).toNumber?.()) : null,
        volumeUnit: v.volumeUnit,
        isActive: v.isActive,
        deletedAt: v.deletedAt,
      })),
    }))

    // Сопоставление
    for (let itemIndex = 0; itemIndex < importData.items.length; itemIndex++) {
      const item = importData.items[itemIndex]
      const result = matchProduct(item, simplifiedProducts)

      if (result.kind === 'match') {
        const product = products.find((p) => p.id === result.productId)
        const variant = product?.variants.find((v) => v.id === result.variantId)

        if (!product || !variant) continue

        // Проверка конфликта: две записи на одну фасовку
        const variantKey = `${result.productId}:${result.variantId}`
        const existingMatch = variantMatches.get(variantKey)
        if (existingMatch) {
          // Конфликт: обе записи отправляем в conflicts
          const prevItem = importData.items[existingMatch.itemIndex]
          conflicts.push({
            item: prevItem,
            reason: `Конфликт: две записи (${prevItem.name}, ${item.name}) на одну фасовку`,
          })
          conflicts.push({
            item,
            reason: `Конфликт: две записи (${prevItem.name}, ${item.name}) на одну фасовку`,
          })
          // Удалить предыдущий match
          matches.splice(
            matches.findIndex((m) => m.product.id === result.productId && m.variant.id === result.variantId),
            1
          )
          continue
        }
        variantMatches.set(variantKey, { itemIndex, productId: result.productId, variantId: result.variantId })

        // Проверка расхождения в розничной цене
        const retailMismatch =
          item.retailKopecks !== null && item.retailKopecks !== variant.retailPrice
            ? { old: variant.retailPrice, new: item.retailKopecks }
            : undefined

        if (retailMismatch) {
          if (applyRetail) {
            // При --apply-retail добавляем в список обновлений
            retailUpdates.push({
              product: product.name,
              variant: item.volume,
              old: retailMismatch.old,
              new: retailMismatch.new,
            })
          } else {
            // Без флага — в список расхождений
            retailMismatches.push({
              product: product.name,
              variant: item.volume,
              item,
              old: retailMismatch.old,
              new: retailMismatch.new,
            })
          }
        }

        matches.push({
          product: { id: product.id, name: product.name },
          variant: { id: variant.id, volumeLabel: item.volume },
          item,
          changes: {
            wholesalePrice: { old: variant.wholesalePrice, new: item.wholesaleKopecks },
            isProfessional: { old: variant.isProfessional, new: item.isProfessional },
            ...(retailMismatch && { retailPriceMismatch: retailMismatch }),
          },
        })
      } else if (result.kind === 'ambiguous') {
        ambiguous.push({
          item,
          candidates: result.candidates,
        })
      } else if (result.kind === 'skip') {
        skipped.push({
          item,
          reason: result.reason,
        })
      } else if (result.kind === 'conflict') {
        conflicts.push({
          item,
          reason: result.reason,
        })
      } else if (result.kind === 'none') {
        unmatched.push({
          item,
          reason: result.reason,
        })
      }
    }

    // Вывод таблицы сопоставлений (ВСЕ строки)
    if (matches.length > 0) {
      console.log(`✅ СОПОСТАВЛЕНО (всего ${matches.length}):`)
      console.table(
        matches.map((m) => ({
          'Товар': m.product.name,
          'Объём': m.variant.volumeLabel,
          'Оптовая цена': `${m.changes.wholesalePrice.old || '—'} → ${m.changes.wholesalePrice.new} ₽`,
          'Pro': `${m.changes.isProfessional.old} → ${m.changes.isProfessional.new}`,
        })),
      )
      console.log()
    }

    // Вывод пропущённых
    if (skipped.length > 0) {
      console.log(`⏭️ ПРОПУЩЕНО (${skipped.length}):`)
      skipped.forEach((s) => {
        console.log(`  • ${s.item.name} (${s.item.volume}) — ${s.reason}`)
      })
      console.log()
    }

    // Вывод конфликтов
    if (conflicts.length > 0) {
      console.log(`⚡ КОНФЛИКТЫ (${conflicts.length}):`)
      conflicts.forEach((c) => {
        console.log(`  • ${c.item.name} (${c.item.volume}) — ${c.reason}`)
      })
      console.log()
    }

    // Вывод несопоставленных
    if (unmatched.length > 0) {
      console.log(`⚠️ НЕСОПОСТАВЛЕННЫЕ (${unmatched.length}):`)
      unmatched.forEach((u) => {
        console.log(`  • ${u.item.name} (${u.item.volume}) — ${u.reason}`)
      })
      console.log()
    }

    // Вывод неоднозначных
    if (ambiguous.length > 0) {
      console.log(`🔀 НЕОДНОЗНАЧНЫЕ (${ambiguous.length}):`)
      ambiguous.forEach((a) => {
        console.log(`  • ${a.item.name} (${a.item.volume})`)
        a.candidates.forEach((c) => console.log(`    - ${c}`))
      })
      console.log()
    }

    // Вывод обновлений розничной цены (при --apply-retail)
    if (retailUpdates.length > 0) {
      console.log(`💰 РОЗНИЦА ОБНОВЛЕНА (${retailUpdates.length}):`)
      console.log('   (oldRetailPrice обнулена — PriceTag не будет зачёркивать при повышении цены)\n')
      retailUpdates.forEach((m) => {
        console.log(`  • ${m.product} (${m.variant}): ${m.old} ₽ → ${m.new} ₽`)
      })
      console.log()
    }

    // Вывод расхождений в розничной цене (без --apply-retail)
    if (retailMismatches.length > 0) {
      console.log(`💰 РАСХОЖДЕНИЯ РОЗНИЧНОЙ ЦЕНЫ (${retailMismatches.length}):`)
      console.log('   (розничную цену не меняем — используйте --apply-retail, если нужно)\n')
      retailMismatches.forEach((m) => {
        console.log(`  • ${m.product} (${m.variant}): ${m.old} ₽ → ${m.new} ₽ (прайс)`)
      })
      console.log()
    }

    // Сводка
    const total = importData.items.length
    console.log(`📊 СВОДКА:`)
    console.log(`  Сопоставлено: ${matches.length}/${total}`)
    console.log(`  Пропущено: ${skipped.length}`)
    console.log(`  Конфликты: ${conflicts.length}`)
    console.log(`  Несопоставлено: ${unmatched.length}`)
    console.log(`  Неоднозначные: ${ambiguous.length}`)
    console.log(`  Расхождения розницы: ${retailMismatches.length}\n`)

    // Если --apply, выполняем запись
    if (isApply && matches.length > 0) {
      console.log('💾 ПРИМЕНЕНИЕ ИЗМЕНЕНИЙ...\n')

      // Транзакция для атомарности
      await prisma.$transaction(async (tx) => {
        // Отследить товары, которые будут обновлены
        const productsToUpdatePrices = new Set<string>()
        let updatedCount = 0
        let unchangedCount = 0

        for (const match of matches) {
          // Загружаем текущий вариант для проверки
          const currentVariant = await tx.productVariant.findUniqueOrThrow({
            where: { id: match.variant.id },
          })

          // Планируем обновление
          const plan = planVariantUpdate(currentVariant, match.item, { applyRetail })

          if (plan.data === null) {
            // Ничего не изменилось
            unchangedCount++
            continue
          }

          // Выполняем обновление
          await tx.productVariant.update({
            where: { id: match.variant.id },
            data: plan.data,
          })

          productsToUpdatePrices.add(match.product.id)
          updatedCount++

          // Вывод обновления
          const changes: string[] = []
          if ((plan.data as any).wholesalePrice !== undefined) {
            changes.push(`оптовая ${(plan.data as any).wholesalePrice}`)
          }
          if ((plan.data as any).isProfessional !== undefined) {
            changes.push(`pro=${(plan.data as any).isProfessional}`)
          }
          if ((plan.data as any).retailPrice !== undefined) {
            changes.push(`розница ${(plan.data as any).retailPrice}`)
          }

          console.log(`  ✓ ${match.product.name} (${match.variant.volumeLabel}): ${changes.join(', ')}`)
        }

        // Пересчёт Product.isProfessional и min/max цен (только если есть обновления)
        if (updatedCount > 0) {
          const affectedProducts = await tx.product.findMany({
            where: { id: { in: Array.from(productsToUpdatePrices) } },
            include: { variants: { where: { isActive: true, deletedAt: null } } },
          })

          for (const product of affectedProducts) {
            const allProfessional = product.variants.length > 0 && product.variants.every((v) => v.isProfessional)

            await tx.product.update({
              where: { id: product.id },
              data: { isProfessional: allProfessional },
            })
          }

          // Пересчёт min/max цен
          await recalcProductPrices(tx)
        }

        // Вывод сводки
        console.log()
        console.log('📊 РЕЗУЛЬТАТ:')
        console.log(`  Обновлено: ${updatedCount}`)
        console.log(`  Без изменений: ${unchangedCount}`)
        if (updatedCount === 0) {
          console.log('  Изменений нет')
        }
        if (updatedCount > 0) {
          console.log('  🔄 Пересчитаны Product.minPrice, maxPrice и isProfessional')
        }
      })

      console.log()
    } else if (isApply) {
      console.log('⚠️ Нечего применять (нет сопоставленных записей)\n')
    } else {
      console.log('🔍 Режим сухого прогона (без записи). Используйте --apply для применения.\n')
    }
  } catch (error) {
    console.error('❌ Ошибка:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
