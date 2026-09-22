import { PrismaClient, type VolumeUnit } from '../../../../node_modules/.prisma/ps-client/index.js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { recalcProductPrices } from '../src/services/product-prices.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface PriceImportItem {
  name: string
  volume: string
  wholesaleKopecks: number
  retailKopecks: number | null
  isProfessional: boolean
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

// Нормализация: нижний регистр, ё→е, убрать кавычки и спецсимволы, лишние пробелы
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»""]/g, '') // кавычки
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // спецсимволы (с поддержкой Unicode букв и цифр)
    .replace(/\s+/g, ' ')
    .trim()
}

// Проверка совпадения:
// 1. Точное равенство нормализованного имени
// 2. Нормализованное имя из прайса является префиксом товара
// 3. Нормализованное имя товара является префиксом прайса (слова в прайсе могут быть более полными)
function isMatch(priceItemName: string, productName: string): boolean {
  const normPrice = normalize(priceItemName)
  const normProduct = normalize(productName)

  if (normPrice === normProduct) return true
  if (normProduct.startsWith(normPrice)) return true
  if (normPrice.startsWith(normProduct)) return true

  return false
}

// Парсинг объёма: извлечение числа и единицы из строки типа "50 мл"
function parseVolume(volumeStr: string): { value: number; unit: VolumeUnit } | null {
  const match = volumeStr.match(/^(\d+(?:[.,]\d+)?)\s*([а-яa-z]+)$/i)
  if (!match) return null

  const value = parseFloat(match[1].replace(',', '.'))
  const unitStr = match[2].toLowerCase()

  let unit: VolumeUnit
  if (unitStr === 'мл' || unitStr === 'ml') {
    unit = 'ml'
  } else if (unitStr === 'г' || unitStr === 'g') {
    unit = 'g'
  } else if (unitStr === 'шт' || unitStr === 'pcs') {
    unit = 'pcs'
  } else {
    return null
  }

  return { value, unit }
}

// Сопоставление фасовки: сравнивают число и единицу
function variantMatches(importVolume: string, variant: { volumeValue: any; volumeUnit: VolumeUnit }): boolean {
  const parsed = parseVolume(importVolume)
  if (!parsed) return false

  // Сравнение числового значения (с допуском на ошибки округления)
  const importValue = parseFloat(parsed.value.toFixed(2))
  const variantValue = parseFloat(variant.volumeValue.toString())

  return Math.abs(importValue - variantValue) < 0.01 && parsed.unit === variant.volumeUnit
}

async function main() {
  const prisma = new PrismaClient()

  // Парсинг аргументов CLI
  const args = process.argv.slice(2)
  let filePath = path.join(__dirname, '../assets/price-import.json')
  let isApply = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      filePath = args[i + 1]
      i++
    } else if (args[i] === '--apply') {
      isApply = true
    }
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
    const retailMismatches: { product: string; variant: string; item: PriceImportItem; old: number; new: number }[] = []

    // Сопоставление
    for (const item of importData.items) {
      const candidates = products.filter((p) => isMatch(item.name, p.name))

      if (candidates.length === 0) {
        unmatched.push({ item, reason: 'Товар не найден в каталоге' })
        continue
      }

      if (candidates.length > 1) {
        ambiguous.push({
          item,
          candidates: candidates.map((c) => `${c.name} (${c.id})`),
        })
        continue
      }

      const product = candidates[0]

      // Выбор фасовки
      let variant = product.variants.find((v) => variantMatches(item.volume, v))

      // Если фасовка одна — брать её независимо от volume
      if (!variant && product.variants.length === 1) {
        variant = product.variants[0]
      }

      if (!variant) {
        unmatched.push({
          item,
          reason: `Товар найден (${product.name}), но нет фасовки ${item.volume}`,
        })
        continue
      }

      // Проверка расхождения в розничной цене
      const retailMismatch =
        item.retailKopecks !== null && item.retailKopecks !== variant.retailPrice
          ? { old: variant.retailPrice, new: item.retailKopecks }
          : undefined

      if (retailMismatch) {
        retailMismatches.push({
          product: product.name,
          variant: item.volume,
          item,
          old: retailMismatch.old,
          new: retailMismatch.new,
        })
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
    }

    // Вывод таблицы сопоставлений
    if (matches.length > 0) {
      console.log('✅ СОПОСТАВЛЕНО (вывод первых 10):')
      console.table(
        matches.slice(0, 10).map((m) => ({
          'Товар': m.product.name,
          'Объём': m.variant.volumeLabel,
          'Оптовая цена': `${m.changes.wholesalePrice.old || '—'} → ${m.changes.wholesalePrice.new} ₽`,
          'Pro': `${m.changes.isProfessional.old} → ${m.changes.isProfessional.new}`,
        })),
      )
      if (matches.length > 10) {
        console.log(`... и ещё ${matches.length - 10}\n`)
      } else {
        console.log()
      }
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

    // Вывод расхождений в розничной цене
    if (retailMismatches.length > 0) {
      console.log(`💰 РАСХОЖДЕНИЯ РОЗНИЧНОЙ ЦЕНЫ (${retailMismatches.length}):`)
      console.log('   (розничную цену не меняем — это отдельное решение)\n')
      retailMismatches.slice(0, 5).forEach((m) => {
        console.log(`  • ${m.product} (${m.variant}): ${m.old} ₽ → ${m.new} ₽ (прайс)`)
      })
      if (retailMismatches.length > 5) {
        console.log(`  ... и ещё ${retailMismatches.length - 5}\n`)
      } else {
        console.log()
      }
    }

    // Сводка
    const total = importData.items.length
    console.log(`📊 СВОДКА:`)
    console.log(`  Сопоставлено: ${matches.length}/${total}`)
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

        for (const match of matches) {
          const variant = await tx.productVariant.update({
            where: { id: match.variant.id },
            data: {
              wholesalePrice: match.changes.wholesalePrice.new,
              isProfessional: match.changes.isProfessional.new,
            },
          })

          productsToUpdatePrices.add(match.product.id)

          // Вывод каждого обновления
          console.log(`  ✓ ${match.product.name} (${match.variant.volumeLabel}): оптовая ${match.changes.wholesalePrice.new}, pro=${match.changes.isProfessional.new}`)
        }

        // Пересчёт Product.isProfessional и min/max цен
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
      })

      console.log(`\n✅ Успешно обновлено ${matches.length} записей`)
      console.log('🔄 Пересчитаны Product.minPrice, maxPrice и isProfessional\n')
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
