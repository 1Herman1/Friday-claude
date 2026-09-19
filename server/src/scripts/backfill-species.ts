import { PrismaClient, type ProductSpecies } from '@prisma/client'
import { determineSpecies, isUniversalCare, mentionsBothSpecies } from '../services/quiz-autotag.js'
import { CAT_ONLY_BRANDS } from '../services/product.service.js'
import { withSpeciesTag } from '../lib/quiz-tags.js'
import { fetchAssortment } from '../services/moysklad/client.js'

const prisma = new PrismaClient()

type Product = {
  id: string
  name: string
  species: ProductSpecies
  quizTags: string[]
  autoQuizTags: string[]
  categories: Array<{ category: { slug: string } }>
  brand: { name: string } | null
  variants: Array<{ moyskladId: string | null }>
}

type SpeciesDecision = {
  productId: string
  name: string
  brandName: string | null
  categorySlugs: string[]
  currentSpecies: ProductSpecies
  newSpecies: ProductSpecies
  reason: string
  isDisputed: boolean
}

// Порядок доверия для определения вида:
// 1. Существующие теги species:* в quizTags/autoQuizTags (товар уже размечен)
// 2. Папка МоегоСклада (если товар привязан и папка содержит явный вид)
// 3. Оба вида в названии → both (универсальный уход)
// 4. Один вид в названии → cat/dog (явное упоминание)
// 5. determineSpecies из quiz-autotag (анализ названия и категорий)
// 6. Бренд только для кошек
// 7. Универсальный уход → both
// 8. Спорное или не определено → unknown

function normalizeCase(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е')
}

function productIdFromHref(href: string | undefined): string | null {
  if (!href) return null
  const match = href.match(/\/entity\/product\/([0-9a-f-]{36})/)
  return match ? match[1] : null
}

async function loadMoyskladSpecies(): Promise<Map<string, 'cat' | 'dog'>> {
  if (!process.env.MOYSKLAD_TOKEN) {
    console.warn('⚠️  MOYSKLAD_TOKEN не задан — папки МоегоСклада не будут использованы')
    return new Map()
  }

  try {
    const rows = (await fetchAssortment()) as Array<{
      id: string
      meta: { type: string }
      pathName?: string
      product?: { meta?: { href?: string } }
    }>

    const byId = new Map(rows.map((row) => [row.id, row]))
    const result = new Map<string, 'cat' | 'dog'>()

    // Для каждой позиции определяем папку (у варианта — родительского товара)
    for (const row of rows) {
      let pathName: string | null = null

      if (row.meta.type === 'variant') {
        // У модификации своей папки может не быть — тогда берём папку родительского
        // товара. Ссылка на родителя приходит не всегда (ассортимент отдаётся без
        // expand), поэтому запасной вариант — собственный путь строки: без него
        // модификации молча выпадали, а это большая часть каталога.
        const parentId = productIdFromHref(row.product?.meta?.href)
        const parent = parentId ? byId.get(parentId) : undefined
        pathName = parent?.pathName ?? row.pathName ?? null
      } else {
        pathName = row.pathName ?? null
      }

      if (!pathName) continue

      const normalized = normalizeCase(pathName)
      const hasCat = normalized.includes('кошк') || normalized.includes('cat')
      const hasDog = normalized.includes('собак') || normalized.includes('dog')

      // Если оба вида или ни один — пропускаем
      if ((hasCat && hasDog) || (!hasCat && !hasDog)) continue

      if (hasCat) result.set(row.id, 'cat')
      if (hasDog) result.set(row.id, 'dog')
    }

    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`⚠️  Ошибка загрузки МоегоСклада (${msg}) — папки не будут использованы`)
    return new Map()
  }
}

function getTagSpecies(tags: string[]): ProductSpecies | null {
  for (const tag of tags) {
    if (tag === 'species:cat') return 'cat'
    if (tag === 'species:dog') return 'dog'
    if (tag === 'species:both') return 'both'
  }
  return null
}

async function determineProductSpecies(product: Product, moyskladSpecies: Map<string, 'cat' | 'dog'>): Promise<{
  species: ProductSpecies
  reason: string
  isDisputed: boolean
}> {
  const categorySlugs = product.categories.map((c) => c.category.slug)

  // 1. Существующие теги (товар уже размечен)
  const tagSpecies = getTagSpecies(product.quizTags)
  if (tagSpecies && tagSpecies !== 'unknown') {
    return { species: tagSpecies, reason: 'тег в quizTags', isDisputed: false }
  }

  const autoTagSpecies = getTagSpecies(product.autoQuizTags)
  if (autoTagSpecies && autoTagSpecies !== 'unknown') {
    return { species: autoTagSpecies, reason: 'тег в autoQuizTags', isDisputed: false }
  }

  // 2. Папка МоегоСклада (данные владельца сильнее эвристик)
  const moyskladId = product.variants[0]?.moyskladId
  if (moyskladId) {
    const msSpecies = moyskladSpecies.get(moyskladId)
    if (msSpecies) {
      return { species: msSpecies, reason: 'папка МоегоСклада', isDisputed: false }
    }
  }

  // 3. Оба вида названы явно — универсальный товар. Проверяем ДО determineSpecies:
  // та возвращает null и здесь, и когда не определила ничего.
  if (mentionsBothSpecies(product.name)) {
    return { species: 'both', reason: 'оба вида в названии', isDisputed: false }
  }

  // 4-5. determineSpecies из quiz-autotag (категории, один вид, маркеры линеек)
  const autotagSpecies = determineSpecies(product.name, categorySlugs)
  if (autotagSpecies === 'cat') {
    return {
      species: 'cat',
      reason: 'определено по названию и категориям',
      isDisputed: false,
    }
  }
  if (autotagSpecies === 'dog') {
    return {
      species: 'dog',
      reason: 'определено по названию и категориям',
      isDisputed: false,
    }
  }
  // 6. Бренд только для кошек
  if (product.brand?.name) {
    const brandNameLower = normalizeCase(product.brand.name)
    for (const catBrand of CAT_ONLY_BRANDS) {
      if (brandNameLower === normalizeCase(catBrand)) {
        return { species: 'cat', reason: 'бренд только для кошек', isDisputed: false }
      }
    }
  }

  // 7. Универсальный уход → both
  if (isUniversalCare(product.name, categorySlugs)) {
    return { species: 'both', reason: 'универсальный уход', isDisputed: false }
  }

  // 8. Не определено → unknown, но это спорное значение
  return { species: 'unknown', reason: 'не определено', isDisputed: true }
}

async function main() {
  const apply = process.argv.includes('--apply')
  // --only-unknown: трогать только неразмеченные товары. Режим для деплой-
  // воркфлоу: полный прогон пересчитал бы и перезаписал вид, выставленный
  // админом вручную, а этот — заполняет пробелы и ничьи правки не трогает.
  const onlyUnknown = process.argv.includes('--only-unknown')

  console.log('\n════════════════════════════════════════════════════════════════════')
  console.log('  Разметка вида животного для товаров (species)')
  console.log('════════════════════════════════════════════════════════════════════')
  console.log(`Режим: ${apply ? '✅ ПРИМЕНЕНИЕ' : '📋 ПРЕДПРОСМОТР (без записи)'}${onlyUnknown ? ' · только неразмеченные' : ''}\n`)

  const moyskladSpecies = await loadMoyskladSpecies()

  // Загружаем ВСЕ товары для статистики по каталогу
  const allProducts = await prisma.product.findMany({
    select: { species: true },
  })
  const totalCatalogSize = allProducts.length
  const catalogStatsBySpecies = new Map<ProductSpecies, number>()
  for (const p of allProducts) {
    catalogStatsBySpecies.set(p.species, (catalogStatsBySpecies.get(p.species) ?? 0) + 1)
  }

  // Загружаем товары для обработки (все или только неразмеченные)
  const products = await prisma.product.findMany({
    ...(onlyUnknown ? { where: { species: 'unknown' as ProductSpecies } } : {}),
    select: {
      id: true,
      name: true,
      species: true,
      quizTags: true,
      autoQuizTags: true,
      categories: { select: { category: { select: { slug: true } } } },
      brand: { select: { name: true } },
      variants: { where: { moyskladId: { not: null } }, select: { moyskladId: true }, take: 1 },
    },
  })

  console.log(`📊 Всего товаров в каталоге: ${totalCatalogSize}`)
  console.log(`Обрабатывается: ${products.length}${onlyUnknown ? ' (только неразмеченные)' : ''}\n`)

  const decisions: SpeciesDecision[] = []
  const statesByReason = new Map<string, number>()
  let disputed: SpeciesDecision[] = []

  // Определяем вид для каждого товара
  for (const product of products) {
    const { species: newSpecies, reason, isDisputed } = await determineProductSpecies(product, moyskladSpecies)

    // Только добавляем в список если есть изменение или это спорный товар
    if (newSpecies !== product.species || isDisputed) {
      decisions.push({
        productId: product.id,
        name: product.name,
        brandName: product.brand?.name ?? null,
        categorySlugs: product.categories.map((c) => c.category.slug),
        currentSpecies: product.species,
        newSpecies,
        reason,
        isDisputed,
      })
    }

    // Статистика методов определения
    statesByReason.set(reason, (statesByReason.get(reason) ?? 0) + 1)
  }

  disputed = decisions.filter((d) => d.isDisputed)

  // Выводим результаты по видам ВО ВСЁМ каталоге
  console.log('📈 РАСПРЕДЕЛЕНИЕ ПО ВИДАМ (весь каталог):')
  const rows: Array<[ProductSpecies, number]> = [
    ['cat', catalogStatsBySpecies.get('cat') ?? 0],
    ['dog', catalogStatsBySpecies.get('dog') ?? 0],
    ['both', catalogStatsBySpecies.get('both') ?? 0],
    ['unknown', catalogStatsBySpecies.get('unknown') ?? 0],
  ]
  for (const [species, count] of rows) {
    const percent = (count / totalCatalogSize) * 100
    console.log(`  ${species.padEnd(10)} ${String(count).padStart(3)}  (${percent.toFixed(1).padStart(5)}%)`)
  }

  // Выводим статистику по методам определения
  console.log('\n📊 КАК ОПРЕДЕЛЯЛИСЬ:')
  const reasonsArray = Array.from(statesByReason.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  for (const [reason, count] of reasonsArray) {
    console.log(`  ${reason.padEnd(50)} ${String(count).padStart(3)}`)
  }

  // Выводим спорные товары
  if (disputed.length > 0) {
    console.log(`\n⚠️  ТРЕБУЕТ РЕШЕНИЯ ВЛАДЕЛЬЦА (${disputed.length} товаров):\n`)
    for (const d of disputed) {
      // Владельцу нужны бренд и разделы, чтобы решить, а не идентификатор:
      // раньше здесь под подписью «Категории» печаталось само название товара.
      console.log(`  • ${d.name}`)
      console.log(`    Бренд: ${d.brandName ?? 'не указан'}`)
      console.log(`    Разделы: ${d.categorySlugs.length ? d.categorySlugs.join(', ') : 'нет'}`)
      console.log(`    id: ${d.productId}\n`)
    }
  }

  // Выводим товары которые будут изменены
  const toChange = decisions.filter((d) => d.currentSpecies !== d.newSpecies)
  if (toChange.length > 0) {
    console.log(`\n📝 БУДЕТ ИЗМЕНЕНО (${toChange.length} товаров):`)
    // Печатаем все: список читает владелец перед записью, а сотня строк —
    // это ровно тот объём, который надо проверить глазами, а не «и ещё 80».
    for (const d of toChange) {
      const arrow = `${d.currentSpecies.padEnd(8)} → ${d.newSpecies.padEnd(8)}`
      console.log(`  ${arrow}  ${d.name.slice(0, 70)}  · ${d.reason}`)
    }
  }

  // Если режим предпросмотра
  if (!apply) {
    console.log(
      '\n📌 Это предпросмотр. Ничего не записано в базу. Для применения запустите с флагом --apply\n'
    )
    return
  }

  // Применяем изменения
  console.log('\n⏳ Применяем изменения в базу...\n')
  let updated = 0
  for (const d of decisions) {
    if (d.currentSpecies !== d.newSpecies) {
      // Тег вида дублируем в quizTags — ручные теги, их выкатка не пересчитывает.
      // autoQuizTags для этого не годятся: backfill-quiz-tags строит их заново
      // каждый деплой, и вид, взятый от бренда или раздела «уход», там не переживёт
      // следующего прогона.
      const product = await prisma.product.findUnique({
        where: { id: d.productId },
        select: { quizTags: true },
      })
      if (!product) continue

      const quizTags = withSpeciesTag(product.quizTags, d.newSpecies)

      await prisma.product.update({
        where: { id: d.productId },
        data: { species: d.newSpecies, quizTags },
      })
      updated++
    }
  }

  console.log(`✅ Успешно обновлено ${updated} товаров.`)
  console.log(`⚠️  ${disputed.length} товаров остались с видом unknown — требует ручной проверки.\n`)
}

main()
  .catch((err) => {
    console.error('❌ Ошибка:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
