import { PrismaClient, CategoryKind, ProductSpecies } from '@prisma/client'
import { QUIZ_TAGS } from '../lib/quiz-tags'
import { classifyType } from '../lib/product-type'

const prisma = new PrismaClient()
const BATCH_SIZE = 200

/** Старые узлы двухуровневого дерева: после переезда на «Вид → Тип → Назначение»
    выключаются (связи товаров остаются — старые ссылки продолжают отдавать товары).
    `care` не в списке: общая «Ветаптека и уход» остаётся пунктом шапки. */
const LEGACY_SLUGS = [
  'dogs-food', 'cats-food', 'dogs-food-dry', 'dogs-food-wet', 'cats-food-dry', 'cats-food-wet',
  'treats', 'treats-dogs', 'treats-cats', 'care-dogs', 'care-cats',
]

interface ProductData {
  id: string
  name: string
  species: ProductSpecies
  quizTags: string[]
  autoQuizTags: string[]
  isGrainFree: boolean
  isHypoallergenic: boolean
  isWeightControl: boolean
  categories: Array<{ categoryId: string }>
}

interface CategoryData {
  id: string
  slug: string
  name: string
  parentId: string | null
  kind: CategoryKind | null
  species: ProductSpecies | null
  isActive: boolean
  sortOrder: number
}

/** Вспомогательная функция: проверяет, есть ли тег у товара. */
function hasTag(product: ProductData, tag: string): boolean {
  return product.quizTags.includes(tag) || product.autoQuizTags.includes(tag)
}

/** Определяет назначение (purpose) для товаров dry/wet по тегам и полям. */
function getPurposes(product: ProductData): string[] {
  const purposes: string[] = []

  // Каждое назначение — это slug части имени категории

  // age:puppy / age:kitten
  if (hasTag(product, 'age:puppy') || hasTag(product, 'age:kitten')) {
    // Добавим оба, потом выберем по виду животного
    if (hasTag(product, 'age:puppy')) purposes.push('puppy')
    if (hasTag(product, 'age:kitten')) purposes.push('kitten')
  }

  // age:adult
  if (hasTag(product, 'age:adult')) {
    purposes.push('adult')
  }

  // age:senior
  if (hasTag(product, 'age:senior')) {
    purposes.push('senior')
  }

  // health:sterilized
  if (hasTag(product, 'health:sterilized')) {
    purposes.push('sterilized')
  }

  // health:digestion
  if (hasTag(product, 'health:digestion')) {
    purposes.push('digestion')
  }

  // isWeightControl или weight:overweight
  if (product.isWeightControl || hasTag(product, 'weight:overweight')) {
    purposes.push('weight')
  }

  // isGrainFree или philosophy:grainfree
  if (product.isGrainFree || hasTag(product, 'philosophy:grainfree')) {
    purposes.push('grainfree')
  }

  // isHypoallergenic или health:allergy
  if (product.isHypoallergenic || hasTag(product, 'health:allergy')) {
    purposes.push('hypoallergenic')
  }

  // health:urinary
  if (hasTag(product, 'health:urinary')) {
    purposes.push('urinary')
  }

  // health:skin
  if (hasTag(product, 'health:skin')) {
    purposes.push('skin')
  }

  // Специфично для собак
  if (product.species === 'dog' || product.species === 'both') {
    // size:mini | size:small
    if (hasTag(product, 'size:mini') || hasTag(product, 'size:small')) {
      purposes.push('small')
    }

    // size:large | size:giant
    if (hasTag(product, 'size:large') || hasTag(product, 'size:giant')) {
      purposes.push('large')
    }
  }

  // Специфично для кошек
  if (product.species === 'cat' || product.species === 'both') {
    // health:hairball
    if (hasTag(product, 'health:hairball')) {
      purposes.push('hairball')
    }

    // lifestyle:indoor
    if (hasTag(product, 'lifestyle:indoor')) {
      purposes.push('indoor')
    }
  }

  return [...new Set(purposes)] // Уникальные значения
}

/** Создаёт или обновляет узел категории. */
async function ensureNode(
  prisma: PrismaClient,
  slug: string,
  name: string,
  parentSlug: string | null,
  kind: CategoryKind | null,
  species: ProductSpecies | null,
  sortOrder: number,
  existingCategories: Map<string, CategoryData>,
): Promise<string> {
  const existing = existingCategories.get(slug)

  if (existing) {
    // Обновляем только пустые поля kind и species
    const updates: any = {}
    if (!existing.kind && kind) updates.kind = kind
    if (!existing.species && species) updates.species = species

    if (Object.keys(updates).length > 0) {
      await prisma.category.update({
        where: { id: existing.id },
        data: updates,
      })
    }

    return existing.id
  }

  // Создаём новую категорию
  let parentId: string | null = null
  if (parentSlug) {
    const parent = existingCategories.get(parentSlug)
    if (parent) {
      parentId = parent.id
    }
  }

  const created = await prisma.category.create({
    data: {
      slug,
      name,
      parentId,
      kind,
      species,
      sortOrder,
      isActive: true,
    },
    select: { id: true },
  })

  // Обновляем кеш
  existingCategories.set(slug, {
    id: created.id,
    slug,
    name,
    parentId,
    kind,
    species,
    isActive: true,
    sortOrder,
  })

  return created.id
}

async function main() {
  const apply = process.argv.includes('--apply')

  // Загружаем все категории
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      parentId: true,
      kind: true,
      species: true,
      isActive: true,
      sortOrder: true,
    },
  })

  const existingCategories = new Map(categories.map((c) => [c.slug, c]))
  // Первый прогон = корней вида ещё нет. Только тогда выключаем старое дерево:
  // если админ потом включит старую категорию обратно, деплой её не тронет.
  const firstRun = !existingCategories.has('dogs') && !existingCategories.has('cats')

  // Загружаем все товары
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      species: true,
      quizTags: true,
      autoQuizTags: true,
      isGrainFree: true,
      isHypoallergenic: true,
      isWeightControl: true,
      categories: { select: { categoryId: true } },
    },
  })

  const stats = {
    createdNodes: 0,
    linkedProducts: 0,
    unknownSpecies: new Map<ProductSpecies, number>(),
    unclassified: [] as string[],
    bySpecies: new Map<ProductSpecies, number>(),
  }

  // Группируем товары по виду
  // «both» (универсальные товары) попадают в обе ветки; «unknown» — только в отчёт.
  const productsBySpecies = new Map<ProductSpecies, ProductData[]>()
  for (const product of products) {
    const targets: ProductSpecies[] = product.species === 'both' ? ['dog', 'cat'] : [product.species]
    for (const target of targets) {
      if (!productsBySpecies.has(target)) productsBySpecies.set(target, [])
      productsBySpecies.get(target)!.push(product)
    }
    stats.bySpecies.set(product.species, (stats.bySpecies.get(product.species) ?? 0) + 1)
  }

  // Подготавливаем привязки товаров
  const toLink: Array<{ productId: string; categoryId: string }> = []

  // Создаём уровень 1: виды животных
  const speciesNodes = new Map<ProductSpecies, { id: string; name: string }>()

  for (const [species, list] of productsBySpecies.entries()) {
    if (species === 'unknown') {
      stats.unknownSpecies.set('unknown', list.length)
      continue
    }

    const speciesName = species === 'dog' ? 'Собаки' : 'Кошки'
    const speciesSlug = species === 'dog' ? 'dogs' : 'cats'

    const existing = existingCategories.get(speciesSlug)
    if (!existing && !apply) {
      console.log(`  [DRY-RUN] Создаст: ${speciesSlug} «${speciesName}» (kind=species, species=${species})`)
    }

    if (apply) {
      const nodeId = await ensureNode(
        prisma,
        speciesSlug,
        speciesName,
        null,
        'species',
        species,
        species === 'dog' ? 0 : 1,
        existingCategories,
      )
      speciesNodes.set(species, { id: nodeId, name: speciesName })

      // Привязываем товары этого вида к категории вида
      for (const product of list) {
        toLink.push({ productId: product.id, categoryId: nodeId })
      }
    } else {
      // dry-run: заполняем speciesNodes для использования в типах и назначениях
      const existingSpecies = existingCategories.get(speciesSlug)
      if (existingSpecies) {
        speciesNodes.set(species, { id: existingSpecies.id, name: speciesName })
      } else {
        // Используем временный ID для dry-run
        speciesNodes.set(species, { id: `temp-${speciesSlug}`, name: speciesName })
      }
    }
  }

  // Создаём уровень 2: типы
  // Структура типов: [dry, wet, treats, medical, vet, care]
  const typeDefinitions: Array<{
    slug: string
    name: string
    sortOrder: number
    forSpecies: ProductSpecies[]
  }> = [
    { slug: '-dry', name: 'Сухой корм', sortOrder: 0, forSpecies: ['dog', 'cat'] },
    { slug: '-wet', name: 'Влажный корм', sortOrder: 1, forSpecies: ['dog', 'cat'] },
    { slug: '-treats', name: 'Лакомства', sortOrder: 2, forSpecies: ['dog', 'cat'] },
    { slug: '-medical', name: 'Лечебное питание', sortOrder: 3, forSpecies: ['dog', 'cat'] },
    { slug: '-vet', name: 'Ветаптека', sortOrder: 4, forSpecies: ['dog', 'cat'] },
    { slug: '-care', name: 'Уход', sortOrder: 5, forSpecies: ['dog', 'cat'] },
  ]

  // Для каждого вида и типа создаём категорию и собираем товары
  const typeNodes = new Map<string, { id: string; species: ProductSpecies }[]>() // slug без префикса → [{id, species}, ...]

  for (const [species, productList] of productsBySpecies.entries()) {
    if (species === 'unknown' || species === 'both') {
      continue
    }

    const speciesPrefix = species === 'dog' ? 'dogs' : 'cats'
    const speciesNode = apply ? speciesNodes.get(species) : null

    for (const typeDef of typeDefinitions) {
      if (!typeDef.forSpecies.includes(species)) continue

      const typeSlug = `${speciesPrefix}${typeDef.slug}`
      const typeName = typeDef.name

      // Фильтруем товары этого типа
      const matchingProducts = productList.filter((p) => classifyType(p) === typeDef.slug.slice(1))

      if (matchingProducts.length === 0 && existingCategories.get(typeSlug)) {
        // Категория есть, но товаров нет — ничего не делаем
        continue
      }

      if (matchingProducts.length === 0) {
        // Товаров нет и категории нет — пропускаем
        continue
      }

      if (!apply) {
        const existing = existingCategories.get(typeSlug)
        if (!existing) {
          console.log(
            `  [DRY-RUN] Создаст: ${typeSlug} «${typeName}» (kind=type, species=${species}) → ${matchingProducts.length} товаров`,
          )
        }
      } else {
        const typeNodeId = await ensureNode(
          prisma,
          typeSlug,
          typeName,
          `${speciesPrefix}`,
          'type',
          species,
          typeDef.sortOrder,
          existingCategories,
        )

        if (!typeNodes.has(typeDef.slug.slice(1))) {
          typeNodes.set(typeDef.slug.slice(1), [])
        }
        typeNodes.get(typeDef.slug.slice(1))!.push({ id: typeNodeId, species })

        // Привязываем товары к типу
        for (const product of matchingProducts) {
          toLink.push({ productId: product.id, categoryId: typeNodeId })
        }
      }
    }
  }

  // Создаём уровень 3: назначения (purpose) только для dry и wet
  if (apply) {
    const purposeTypeNames = ['dry', 'wet']

    for (const [species, productList] of productsBySpecies.entries()) {
      if (species === 'unknown' || species === 'both') {
        continue
      }

      const speciesPrefix = species === 'dog' ? 'dogs' : 'cats'

      for (const typeDefSlug of ['dry', 'wet']) {
        const parentTypeSlug = `${speciesPrefix}-${typeDefSlug}`
        const parentTypeNode = typeNodes.get(typeDefSlug)?.find((n) => n.species === species)

        if (!parentTypeNode) continue

        // Продукты этого типа
        const typeProducts = productList.filter((p) => classifyType(p) === typeDefSlug)

        // Собираем все назначения среди этих продуктов
        const purposeMap = new Map<string, { name: string; products: string[] }>()

        const purposeDefinitions: Record<string, { name: string; slug: string }> = {
          puppy: { name: 'Щенки', slug: 'puppy' },
          kitten: { name: 'Котята', slug: 'kitten' },
          adult: { name: 'Взрослые', slug: 'adult' },
          senior: { name: 'Пожилые', slug: 'senior' },
          sterilized: { name: 'Стерилизованные', slug: 'sterilized' },
          digestion: { name: 'Чувствительное пищеварение', slug: 'digestion' },
          weight: { name: 'Контроль веса', slug: 'weight' },
          grainfree: { name: 'Беззерновой', slug: 'grainfree' },
          hypoallergenic: { name: 'Гипоаллергенный', slug: 'hypoallergenic' },
          urinary: { name: 'Мочевыделительная система', slug: 'urinary' },
          skin: { name: 'Кожа и шерсть', slug: 'skin' },
          small: { name: 'Мелкие породы', slug: 'small' },
          large: { name: 'Крупные породы', slug: 'large' },
          hairball: { name: 'Вывод шерсти', slug: 'hairball' },
          indoor: { name: 'Домашние', slug: 'indoor' },
        }

        for (const product of typeProducts) {
          const purposes = getPurposes(product)

          // Фильтруем назначения в зависимости от вида животного
          for (const purpose of purposes) {
            if (species === 'dog' && ['kitten', 'hairball', 'indoor'].includes(purpose)) {
              continue
            }
            if (species === 'cat' && ['puppy', 'small', 'large'].includes(purpose)) {
              continue
            }

            if (!purposeMap.has(purpose)) {
              const def = purposeDefinitions[purpose]
              if (!def) continue

              purposeMap.set(purpose, { name: def.name, products: [] })
            }

            purposeMap.get(purpose)!.products.push(product.id)
          }
        }

        // Создаём категории для каждого назначения
        // Порядок — как в purposeDefinitions (возраст → здоровье → размер), а не как встретилось в товарах.
        let purposeSortOrder = 0
        for (const purposeKey of Object.keys(purposeDefinitions)) {
          const purposeData = purposeMap.get(purposeKey)
          if (!purposeData || purposeData.products.length === 0) continue

          const purposeSlug = `${parentTypeSlug}-${purposeKey}`
          const purposeName = purposeData.name

          const purposeNodeId = await ensureNode(
            prisma,
            purposeSlug,
            purposeName,
            parentTypeSlug,
            'purpose',
            species,
            purposeSortOrder++,
            existingCategories,
          )

          // Привязываем товары к назначению
          for (const productId of purposeData.products) {
            toLink.push({ productId, categoryId: purposeNodeId })
          }
        }
      }
    }
  }

  // Неклассифицированные товары
  for (const product of products) {
    const type = classifyType(product)
    if (!type || product.species === 'unknown') {
      stats.unclassified.push(product.name)
    }
  }

  // Отчёт
  console.log('\n════════ ИЕРАРХИЯ КАТЕГОРИЙ ════════')
  console.log(`Режим: ${apply ? 'ПРИМЕНЕНИЕ' : 'предпросмотр (без записи)'}`)

  console.log('\n--- По видам животных ---')
  for (const [species, count] of stats.bySpecies.entries()) {
    if (species !== 'unknown' && species !== 'both') {
      const speciesName = species === 'dog' ? 'Собаки' : 'Кошки'
      console.log(`  ${speciesName.padEnd(15)} ${count} товаров`)
    }
  }

  if (stats.unknownSpecies.size > 0) {
    console.log('\n--- Товары с неизвестным видом ---')
    for (const [species, count] of stats.unknownSpecies.entries()) {
      console.log(`  ${species.padEnd(15)} ${count} товаров`)
    }
  }

  if (stats.unclassified.length > 0) {
    console.log(`\n--- Без типа, только в корне вида (${stats.unclassified.length}), первые 30 ---`)
    for (const name of stats.unclassified.slice(0, 30)) {
      console.log(`  • ${name.slice(0, 70)}`)
    }
  }

  if (!apply) {
    console.log('\n📌 Предпросмотр. Ничего не записано. Для применения — флаг --apply\n')
    return
  }

  // Привязываем товары пачками
  for (let i = 0; i < toLink.length; i += BATCH_SIZE) {
    const batch = toLink.slice(i, i + BATCH_SIZE)
    await prisma.productCategory.createMany({
      data: batch,
      skipDuplicates: true,
    })
  }

  // Старое дерево выключаем только когда новое реально наполнено.
  if (firstRun && toLink.length > 0) {
    const legacy = await prisma.category.updateMany({
      where: { slug: { in: LEGACY_SLUGS }, isActive: true },
      data: { isActive: false },
    })
    if (legacy.count > 0) console.log(`Выключено старых категорий: ${legacy.count}`)
  }

  console.log(`\n✅ Создано узлов, привязано товаров: ${toLink.length}.\n`)
}

main()
  .catch((err) => {
    console.error('❌', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
