/**
 * Скрипт разведки МойСклад ЭТАП 1.
 * Читает данные из МойСклада и нашей БД, печатает 7 разделов анализа.
 * НИЧЕГО НЕ пишет и не отправляет.
 *
 * Запуск: npx tsx server/src/scripts/moysklad-report.ts
 */
import { PrismaClient } from '@prisma/client'
import { fetchAssortment, fetchStockCurrent } from '../services/moysklad/client.js'
import { normalizeArticle } from '../services/moysklad/plan.js'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('📡 Получаю данные из МойСклада...\n')

    const assortment = await fetchAssortment()
    const stocks = await fetchStockCurrent()

    console.log('='.repeat(80))
    console.log('1. РАЗБИВКА АССОРТИМЕНТА ПО ТИПАМ\n')

    const typeCount = new Map<string, number>()
    assortment.forEach((item) => {
      const type = item.meta.type || 'unknown'
      typeCount.set(type, (typeCount.get(type) ?? 0) + 1)
    })

    console.log(`Всего позиций: ${assortment.length}`)
    Array.from(typeCount.entries())
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`)
      })

    console.log('\n' + '='.repeat(80))
    console.log('2. ПОЗИЦИИ С ПУСТЫМ ARTICLE\n')

    const emptyArticle = assortment.filter((item) => !item.article)
    console.log(`Всего без артикула: ${emptyArticle.length} (${((emptyArticle.length / assortment.length) * 100).toFixed(1)}%)`)

    const emptyByType = new Map<string, number>()
    emptyArticle.forEach((item) => {
      const type = item.meta.type || 'unknown'
      emptyByType.set(type, (emptyByType.get(type) ?? 0) + 1)
    })

    Array.from(emptyByType.entries())
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        const total = typeCount.get(type) ?? 0
        console.log(`  ${type}: ${count} из ${total}`)
      })

    console.log('\n' + '='.repeat(80))
    console.log('3. ТИПЫ ЦЕН (SALPRICES[].PRICETYPE.NAME)\n')

    const priceTypes = new Map<string, number>()
    assortment.forEach((item) => {
      if (item.salePrices && item.salePrices.length > 0) {
        const typeName = item.salePrices[0].priceType?.name || '(без типа)'
        priceTypes.set(typeName, (priceTypes.get(typeName) ?? 0) + 1)
      }
    })

    if (priceTypes.size === 0) {
      console.log('Позиций с ценами не найдено')
    } else {
      Array.from(priceTypes.entries())
        .sort(([, a], [, b]) => b - a)
        .forEach(([typeName, count]) => {
          console.log(`  "${typeName}": ${count} позиций`)
        })
    }

    console.log('\n' + '='.repeat(80))
    console.log('4. ПРОВЕРКА ЕДИНИЦ ЦЕНЫ\n')

    const withPrice = assortment.filter((item) => item.salePrices && item.salePrices.length > 0 && item.salePrices[0].value > 0)
    const sampleItems = withPrice.slice(0, 5)

    if (sampleItems.length === 0) {
      console.log('Позиций с непустой ценой не найдено')
    } else {
      sampleItems.forEach((item) => {
        const price = item.salePrices![0]
        const priceType = price.priceType?.name || '(без типа)'
        console.log(`${item.name} | salePrices[0].value = ${price.value} | priceType = "${priceType}"`)
      })
      console.log('\n📌 ПОЯСНЕНИЕ: если value выше = 39900 → это копейки (399 ₽), если = 399 → рубли')
    }

    console.log('\n' + '='.repeat(80))
    console.log('5. СОПОСТАВЛЕНИЕ С НАШЕЙ БД (PRODUCTVARIANT.SKU)\n')

    const ourVariants = await prisma.productVariant.findMany({
      where: { sku: { not: null } },
      select: {
        id: true,
        sku: true,
        price: true,
        stock: true,
        product: { select: { name: true } },
      },
    })

    // Нормализуем артикулы
    const ourMap = new Map<string, typeof ourVariants>() // normalized → [variants]
    ourVariants.forEach((v) => {
      const normalized = normalizeArticle(v.sku)
      if (!ourMap.has(normalized)) {
        ourMap.set(normalized, [])
      }
      ourMap.get(normalized)!.push(v)
    })

    const msMap = new Map<string, typeof assortment>() // normalized → [items]
    assortment.forEach((item) => {
      const normalized = normalizeArticle(item.article)
      if (normalized) {
        if (!msMap.has(normalized)) {
          msMap.set(normalized, [])
        }
        msMap.get(normalized)!.push(item)
      }
    })

    // Посчитаем совпадения
    let matched = 0
    let notMatched = 0
    let msNotFound = 0
    const notMatchedExamples: Array<{ sku: string; name: string }> = []
    const msNotFoundExamples: Array<{ article: string; name: string }> = []
    const duplicateArticles: Array<{ normalized: string; items: (typeof assortment)[0][] }> = []

    // Пройдём по МойСкладу
    msMap.forEach((items, normalized) => {
      if (items.length > 1) {
        duplicateArticles.push({ normalized, items })
      }

      const ourItem = ourMap.get(normalized)
      if (ourItem && ourItem.length === 1) {
        matched++
      } else {
        msNotFound++
        if (msNotFoundExamples.length < 20) {
          msNotFoundExamples.push({ article: items[0].article || '', name: items[0].name })
        }
      }
    })

    // Пройдём по нашей БД
    ourMap.forEach((variants, normalized) => {
      const msItems = msMap.get(normalized)
      if (!msItems || msItems.length !== 1) {
        notMatched++
        if (notMatchedExamples.length < 20) {
          const v = variants[0]
          notMatchedExamples.push({ sku: v.sku || '', name: v.product.name })
        }
      }
    })

    console.log(`Наших вариантов с SKU: ${ourVariants.length}`)
    console.log(`  Сматчилось: ${matched}`)
    console.log(`  Не сматчилось: ${notMatched}`)
    if (notMatchedExamples.length > 0) {
      console.log(`  Примеры (не более 20):`)
      notMatchedExamples.forEach((ex) => {
        console.log(`    - ${ex.sku} | ${ex.name}`)
      })
    }

    console.log(`\nПозиций МойСклада с артиклом: ${msMap.size}`)
    console.log(`  Найдены в БД: ${matched}`)
    console.log(`  Не найдены: ${msNotFound}`)
    if (msNotFoundExamples.length > 0) {
      console.log(`  Примеры (не более 20):`)
      msNotFoundExamples.forEach((ex) => {
        console.log(`    - ${ex.article} | ${ex.name}`)
      })
    }

    if (duplicateArticles.length > 0) {
      console.log(`\n⚠️  НЕОДНОЗНАЧНЫЕ АРТИКУЛЫ (один артикул → несколько позиций МС):`)
      duplicateArticles.forEach(({ normalized, items }) => {
        console.log(`  Артикул "${normalized}":`)
        items.forEach((item) => {
          console.log(`    - ${item.name} (id: ${item.id})`)
        })
      })
    }

    console.log('\n' + '='.repeat(80))
    console.log('6. СРАВНЕНИЕ 5 СМАТЧЕННЫХ ПОЗИЦИЙ\n')

    // Остатки по id позиции — обращение по ключу вместо перебора на каждой строке
    const stockById = new Map(stocks.map(s => [s.assortmentId, s.stock]))

    let comparisonCount = 0
    msMap.forEach((msItems, normalized) => {
      if (comparisonCount >= 5) return

      const ourItem = ourMap.get(normalized)
      if (!ourItem || ourItem.length !== 1) return

      const ourV = ourItem[0]
      const msItem = msItems[0]
      const msPrice = msItem.salePrices?.[0]?.value ?? null
      const msStock = stockById.get(msItem.id) ?? '—'

      console.log(
        `${msItem.name} | наша цена ${ourV.price} (копейки) | МС ${msPrice} | наш остаток ${ourV.stock} | МС ${msStock}`
      )

      comparisonCount++
    })

    if (comparisonCount === 0) {
      console.log('Нет сматченных позиций для сравнения')
    }

    console.log('\n' + '='.repeat(80))
    console.log('7. ФОРМАТ ОТВЕТА ОСТАТКОВ (ПЕРВЫЕ 3 ЭЛЕМЕНТА)\n')

    console.log(`Получено строк остатков: ${stocks.length}`)
    console.log(JSON.stringify(stocks.slice(0, 3), null, 2))
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
