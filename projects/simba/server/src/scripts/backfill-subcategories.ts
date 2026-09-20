import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BATCH_SIZE = 200

/** Вспомогательная функция: проверяет, есть ли тег у товара. */
function hasTag(product: { quizTags: string[]; autoQuizTags: string[] }, tag: string): boolean {
  return product.quizTags.includes(tag) || product.autoQuizTags.includes(tag)
}

/** Сценарии создания подкатегорий. */
const scenarios = [
  {
    rootSlug: 'dogs-food',
    children: [
      {
        slug: 'dogs-food-dry',
        name: 'Сухой корм',
        condition: (p: any) => hasTag(p, 'format:dry'),
      },
      {
        slug: 'dogs-food-wet',
        name: 'Влажный корм',
        condition: (p: any) => hasTag(p, 'format:wet'),
      },
    ],
  },
  {
    rootSlug: 'cats-food',
    children: [
      {
        slug: 'cats-food-dry',
        name: 'Сухой корм',
        condition: (p: any) => hasTag(p, 'format:dry'),
      },
      {
        slug: 'cats-food-wet',
        name: 'Влажный корм',
        condition: (p: any) => hasTag(p, 'format:wet'),
      },
    ],
  },
  {
    rootSlug: 'treats',
    children: [
      {
        slug: 'treats-dogs',
        name: 'Для собак',
        condition: (p: any) => p.species === 'dog' || p.species === 'both',
      },
      {
        slug: 'treats-cats',
        name: 'Для кошек',
        condition: (p: any) => p.species === 'cat' || p.species === 'both',
      },
    ],
  },
  {
    rootSlug: 'care',
    children: [
      {
        slug: 'care-dogs',
        name: 'Для собак',
        condition: (p: any) => p.species === 'dog' || p.species === 'both',
      },
      {
        slug: 'care-cats',
        name: 'Для кошек',
        condition: (p: any) => p.species === 'cat' || p.species === 'both',
      },
    ],
  },
]

async function main() {
  const apply = process.argv.includes('--apply')

  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, name: true },
  })
  const bySlug = new Map(categories.map((c) => [c.slug, c]))

  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      isActive: true,
      species: true,
      quizTags: true,
      autoQuizTags: true,
      categories: { select: { categoryId: true } },
    },
  })

  const toCreate: Array<{ slug: string; name: string; parentId: string; index: number }> = []
  const toLinkProducts: Array<{ subcategoryId: string; productIds: string[] }> = []
  const skipReasons: string[] = []
  const unknownSpeciesPerRoot = new Map<string, number>()

  for (const scenario of scenarios) {
    const root = bySlug.get(scenario.rootSlug)
    if (!root) {
      console.warn(
        `⚠️  В базе нет корневой категории «${scenario.rootSlug}» — подкатегории пропущены`,
      )
      continue
    }

    // Товары, уже привязанные к корню и активные
    const productsInRoot = products.filter(
      (p) => p.isActive && p.categories.some((c) => c.categoryId === root.id),
    )

    // Подсчитаем товары с неизвестным видом животного
    const unknownInRoot = productsInRoot.filter((p) => p.species === 'unknown').length
    if (unknownInRoot > 0) {
      unknownSpeciesPerRoot.set(scenario.rootSlug, unknownInRoot)
    }

    for (let index = 0; index < scenario.children.length; index++) {
      const childSpec = scenario.children[index]
      const matching = productsInRoot.filter((p) => childSpec.condition(p))

      if (matching.length === 0) {
        skipReasons.push(`пропуск: нет товаров для ${scenario.rootSlug} → ${childSpec.slug}`)
        continue
      }

      toCreate.push({
        slug: childSpec.slug,
        name: childSpec.name,
        parentId: root.id,
        index,
      })

      toLinkProducts.push({
        subcategoryId: childSpec.slug, // На этапе создания используем slug как ключ, потом заменим на id
        productIds: matching.map((p) => p.id),
      })
    }
  }

  console.log('\n════════ СОЗДАНИЕ ПОДКАТЕГОРИЙ ════════')
  console.log(`Режим: ${apply ? 'ПРИМЕНЕНИЕ' : 'предпросмотр (без записи)'}`)
  console.log(`\nКатегорий к созданию: ${toCreate.length}`)

  if (toCreate.length > 0) {
    console.log('\n--- Создаваемые подкатегории ---')
    for (const item of toCreate) {
      const linked = toLinkProducts.find((lp) => lp.subcategoryId === item.slug)
      const count = linked?.productIds.length ?? 0
      console.log(`  ${item.slug.padEnd(20)} → ${count} товаров`)
    }
  }

  if (unknownSpeciesPerRoot.size > 0) {
    console.log(`\n--- Товары с неизвестным видом (species=unknown) ---`)
    for (const [root, count] of unknownSpeciesPerRoot.entries()) {
      console.log(`  ${root}: ${count} товаров`)
    }
  }

  if (skipReasons.length > 0) {
    console.log(`\n--- Пропущено (${skipReasons.length}) ---`)
    for (const reason of skipReasons.slice(0, 20)) {
      console.log(`  ${reason}`)
    }
  }

  if (!apply) {
    console.log('\n📌 Предпросмотр. Ничего не записано. Для применения — флаг --apply\n')
    return
  }

  // Создание подкатегорий
  const slugToId = new Map<string, string>()
  for (const item of toCreate) {
    const existing = bySlug.get(item.slug)
    if (existing) {
      slugToId.set(item.slug, existing.id)
    } else {
      const created = await prisma.category.create({
        data: {
          slug: item.slug,
          name: item.name,
          parentId: item.parentId,
          sortOrder: item.index + 1,
          isActive: true,
        },
        select: { id: true },
      })
      slugToId.set(item.slug, created.id)
    }
  }

  // Привязка товаров к подкатегориям
  for (const linkSpec of toLinkProducts) {
    const subcategoryId = slugToId.get(linkSpec.subcategoryId)
    if (!subcategoryId) continue

    for (let i = 0; i < linkSpec.productIds.length; i += BATCH_SIZE) {
      const batch = linkSpec.productIds.slice(i, i + BATCH_SIZE)
      await prisma.productCategory.createMany({
        data: batch.map((productId) => ({ productId, categoryId: subcategoryId })),
        skipDuplicates: true,
      })
    }
  }

  const totalProducts = toLinkProducts.reduce((sum, lp) => sum + lp.productIds.length, 0)
  console.log(`\n✅ Создано подкатегорий: ${toCreate.length}, привязано товаров: ${totalProducts}.\n`)
}

main()
  .catch((err) => {
    console.error('❌', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
