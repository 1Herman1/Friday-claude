import * as XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import { normalizeArticle } from '../services/moysklad/plan.js'
import { readFileSync } from 'fs'

const prisma = new PrismaClient()

// ─── ТИПЫ ────────────────────────────────────────────────────────────────────

type ExcelRow = Record<string, unknown>

type PriceUpdateRow = {
  article: string
  articleNormalized: string
  productName: string
  newPriceRubles: number
  newPriceCopeks: number
}

type UpdateResult = {
  variantId: string
  sku: string
  productName: string
  oldPriceCopeks: number
  newPriceCopeks: number
  applied: boolean
  skipReason?: 'unchanged' | 'priceDrop'
}

type Report = {
  totalRowsWithPrice: number
  matchedCount: number
  willUpdateCount: number
  unchangedCount: number
  skippedPriceDrop: UpdateResult[]
  notFoundExamples: PriceUpdateRow[]
  ambiguousExamples: { article: string; skus: string[]; count: number }[]
}

// ─── ПАРСИНГ EXCEL ───────────────────────────────────────────────────────────

function parseExcelFile(filePath: string): PriceUpdateRow[] {
  const buffer = readFileSync(filePath)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]

  if (!sheet) {
    throw new Error('Excel файл пуст или первый лист не найден')
  }

  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' })

  // Ищем индекс колонки "Цена" по заголовку
  if (rows.length === 0) {
    throw new Error('Файл не содержит данных')
  }

  const firstRow = rows[0]
  let priceColumnKey: string | null = null

  // Ищем колонку с заголовком "Цена"
  for (const key of Object.keys(firstRow)) {
    if (key.trim().toLowerCase() === 'цена') {
      priceColumnKey = key
      break
    }
  }

  if (!priceColumnKey) {
    throw new Error('Колонка "Цена" не найдена в файле')
  }

  const results: PriceUpdateRow[] = []

  // Пропускаем первую строку (заголовок)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]

    // Получаем цену
    const priceRaw = row[priceColumnKey]
    let priceRubles = 0

    if (priceRaw !== null && priceRaw !== undefined && priceRaw !== '') {
      const priceNum = typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw))
      if (!isNaN(priceNum) && priceNum > 0) {
        priceRubles = priceNum
      }
    }

    // Пропускаем если цена пустая, ноль или невалидна
    if (priceRubles <= 0) {
      continue
    }

    // Получаем артикул
    const articleRaw = row['Артикул']
    if (!articleRaw) {
      continue
    }

    const article = String(articleRaw).trim()
    const articleNormalized = normalizeArticle(article)

    if (!articleNormalized) {
      continue
    }

    // Получаем имя товара для отчёта
    const productName = String(row['Имя'] || row['Наименование'] || 'N/A').trim()

    results.push({
      article,
      articleNormalized,
      productName,
      newPriceRubles: priceRubles,
      newPriceCopeks: Math.round(priceRubles * 100),
    })
  }

  return results
}

// ─── ФИЛЬТРАЦИЯ И МАТЧИНГ ────────────────────────────────────────────────────

async function findVariantBySku(
  articleNormalized: string
): Promise<{ id: string; sku: string; price: number } | null> {
  // Ищем все активные варианты с непустым sku
  const variants = await prisma.productVariant.findMany({
    where: { isActive: true, sku: { not: null } },
    select: { id: true, sku: true, price: true },
  })

  // Нормализуем sku и ищем совпадение
  const matches = variants.filter(v => v.sku && normalizeArticle(v.sku) === articleNormalized)

  if (matches.length === 0) return null
  if (matches.length === 1) {
    const match = matches[0]
    // sku не может быть null (filter выше исключает это)
    return { id: match.id, sku: match.sku!, price: match.price }
  }

  // Если больше одного — это неоднозначность, сигнализируем null
  return null
}

// ─── ОСНОВНАЯ ЛОГИКА ─────────────────────────────────────────────────────────

async function main() {
  try {
    // Парсим аргументы командной строки
    const args = process.argv.slice(2)

    if (args.length === 0) {
      console.error('❌ Ошибка: укажите путь к файлу Excel как первый аргумент')
      console.error('Использование: npx tsx update-prices-from-excel.ts <path> [--apply] [--max-drop-percent=N]')
      process.exit(1)
    }

    const filePath = args[0]
    const apply = args.includes('--apply')

    let maxDropPercent = 50
    const dropPercentArg = args.find(a => a.startsWith('--max-drop-percent='))
    if (dropPercentArg) {
      const num = parseFloat(dropPercentArg.split('=')[1])
      if (!isNaN(num) && num >= 0) {
        maxDropPercent = num
      }
    }

    console.log('📊 Чтение Excel файла...')
    const excelRows = parseExcelFile(filePath)
    console.log(`✓ Прочитано ${excelRows.length} строк с ценой > 0`)

    if (excelRows.length === 0) {
      console.log('⚠️  Строк с ценой не найдено')
      return
    }

    // Ищем варианты в БД
    console.log('\n🔍 Поиск товаров в базе данных...')
    const updateCandidates: UpdateResult[] = []
    const notFound: PriceUpdateRow[] = []
    const ambiguous = new Map<string, Set<string>>()

    for (const row of excelRows) {
      const variant = await findVariantBySku(row.articleNormalized)

      if (!variant) {
        // Проверяем есть ли такой артикул вообще
        const allVariants = await prisma.productVariant.findMany({
          where: { isActive: true, sku: { not: null } },
          select: { id: true, sku: true },
        })

        const ambiguousMatches = allVariants.filter(
          v => v.sku && normalizeArticle(v.sku) === row.articleNormalized
        )

        if (ambiguousMatches.length > 1) {
          if (!ambiguous.has(row.articleNormalized)) {
            ambiguous.set(row.articleNormalized, new Set())
          }
          ambiguousMatches.forEach(m => ambiguous.get(row.articleNormalized)!.add(m.sku!))
        } else {
          notFound.push(row)
        }
        continue
      }

      // Проверяем логику: будет ли это обновление?
      let skipReason: UpdateResult['skipReason'] | undefined

      if (variant.price === row.newPriceCopeks) {
        skipReason = 'unchanged'
      } else if (variant.price > 0) {
        const dropPercent = ((variant.price - row.newPriceCopeks) / variant.price) * 100
        if (dropPercent > maxDropPercent) {
          skipReason = 'priceDrop'
        }
      }

      updateCandidates.push({
        variantId: variant.id,
        sku: variant.sku!,
        productName: row.productName,
        oldPriceCopeks: variant.price,
        newPriceCopeks: row.newPriceCopeks,
        applied: false,
        skipReason,
      })
    }

    // Разделяем на категории
    const willUpdate = updateCandidates.filter(u => !u.skipReason)
    const skippedPriceDrop = updateCandidates.filter(u => u.skipReason === 'priceDrop')
    const unchanged = updateCandidates.filter(u => u.skipReason === 'unchanged')

    // Подготавливаем отчёт
    const report: Report = {
      totalRowsWithPrice: excelRows.length,
      matchedCount: updateCandidates.length,
      willUpdateCount: willUpdate.length,
      unchangedCount: unchanged.length,
      skippedPriceDrop,
      notFoundExamples: notFound.slice(0, 20),
      ambiguousExamples: Array.from(ambiguous.entries()).map(([article, skus]) => ({
        article,
        skus: Array.from(skus),
        count: skus.size,
      })),
    }

    // Выводим отчёт
    console.log('\n📋 ════════════════════════════════════════════════════════')
    console.log('СВОДКА ОБНОВЛЕНИЯ ЦЕН')
    console.log('════════════════════════════════════════════════════════')
    console.log(`Строк в файле с ценой:        ${report.totalRowsWithPrice}`)
    console.log(`Найдено в БД однозначно:      ${report.matchedCount}`)
    console.log(`  ├─ Будет обновлено:         ${report.willUpdateCount}`)
    console.log(`  ├─ Без изменений:           ${report.unchangedCount}`)
    console.log(`  └─ Пропущено (падение):     ${report.skippedPriceDrop.length}`)
    console.log(`Не найдено в БД:              ${report.notFoundExamples.length}`)
    console.log(`Неоднозначно (дубли):         ${report.ambiguousExamples.length}`)

    // Детали по падению цены
    if (report.skippedPriceDrop.length > 0) {
      console.log('\n⚠️  Пропущено (падение цены > ' + maxDropPercent + '%):\n')
      for (const item of report.skippedPriceDrop.slice(0, 10)) {
        const oldRub = (item.oldPriceCopeks / 100).toFixed(2)
        const newRub = (item.newPriceCopeks / 100).toFixed(2)
        const dropPercent = (
          ((item.oldPriceCopeks - item.newPriceCopeks) / item.oldPriceCopeks) *
          100
        ).toFixed(1)
        console.log(
          `  • ${item.productName} (SKU: ${item.sku})\n` +
          `    ${oldRub} ₽ → ${newRub} ₽ (падение ${dropPercent}%)\n`
        )
      }
      if (report.skippedPriceDrop.length > 10) {
        console.log(`  ... и ещё ${report.skippedPriceDrop.length - 10} позиций\n`)
      }
    }

    // Примеры не найденных
    if (report.notFoundExamples.length > 0) {
      console.log('\n❌ Примеры не найденных товаров:\n')
      for (const item of report.notFoundExamples.slice(0, 5)) {
        console.log(`  • ${item.productName} (артикул: ${item.article})`)
      }
      if (report.notFoundExamples.length > 5) {
        console.log(`  ... и ещё ${report.notFoundExamples.length - 5}`)
      }
      console.log()
    }

    // Примеры неоднозначных
    if (report.ambiguousExamples.length > 0) {
      console.log('\n⚠️  Неоднозначные артикулы (несколько SKU):\n')
      for (const item of report.ambiguousExamples.slice(0, 5)) {
        console.log(`  • Артикул ${item.article}:`)
        for (const sku of item.skus) {
          console.log(`    - ${sku}`)
        }
      }
      if (report.ambiguousExamples.length > 5) {
        console.log(`  ... и ещё ${report.ambiguousExamples.length - 5}`)
      }
      console.log()
    }

    // Финал
    if (!apply) {
      console.log('\n📌 Это предварительный просмотр. Изменения НЕ применены.')
      console.log('Для применения запустите ту же команду с флагом --apply\n')
      return
    }

    // APPLY MODE: обновляем БД
    if (willUpdate.length === 0) {
      console.log('\n⚠️  Нечего обновлять.\n')
      return
    }

    console.log('\n💾 Применение обновлений в БД...')

    // Транзакция с обновлениями
    const updates = willUpdate.map(item =>
      prisma.productVariant.update({
        where: { id: item.variantId },
        data: { price: item.newPriceCopeks },
      })
    )

    await prisma.$transaction(updates)

    console.log(`✅ Обновлено ${willUpdate.length} вариантов товара.\n`)
  } catch (error) {
    console.error('❌ Ошибка:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
