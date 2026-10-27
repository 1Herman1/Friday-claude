import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

// Названия, короткие описания и состав после сверки с INCI (27.10.2026); сид товары существующие не трогает, поэтому обновляем разово
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CATALOG_FILE = path.join(__dirname, '../assets/catalog-curated.json')
const SLUGS = [
  'tts-energizing-mask-maska-so-stvolovymi-kletkami',
  'scrub-lotion-krem-dlya-snyatiya-makiyazha',
  '3-flower-serum-multi-uvlazhnyayushhaya-syvorotka',
  'tts-moisturizing-mask-uvlazhnyayushhaya-maska',
] as const
const BRAND = 'ISSEIMI'

interface CatalogProduct {
  slug: string
  name: string
  brand: string
  action: string | null
  ingredients: string[]
}

interface Wanted {
  slug: string
  name: string
  shortDescription: string | null
}

interface IngredientPlan {
  productId: string
  before: string[]
  after: string[]
}

function wantedFrom(product: CatalogProduct): Wanted {
  return {
    slug: product.slug,
    name: product.name,
    shortDescription: product.action ? product.action.split('.')[0].slice(0, 160) : null,
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[а-яёА-ЯЁ]/g, (char) => {
      const translitMap: Record<string, string> = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
        'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i',
        'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
        'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
        'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch',
        'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '',
        'э': 'e', 'ю': 'yu', 'я': 'ya',
      }
      return translitMap[char] || char
    })
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i])
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  console.log(`Режим: ${apply ? 'ЗАПИСЬ В БАЗУ' : 'сухой прогон'}`)

  const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8')) as { products: CatalogProduct[] }
  const wanted = SLUGS.map((slug) => {
    const product = catalog.products.find((item) => item.slug === slug)
    if (!product) throw new Error(`нет в catalog-curated.json: ${slug}`)
    return wantedFrom(product)
  })
  const isseimi = catalog.products.filter((item) => item.brand === BRAND)

  const prisma = new PrismaClient()
  try {
    const rows = await prisma.product.findMany({
      where: { slug: { in: [...SLUGS] } },
      select: { id: true, slug: true, name: true, shortDescription: true },
    })
    const missing = SLUGS.filter((slug) => !rows.some((row) => row.slug === slug))
    if (missing.length > 0) throw new Error(`нет в базе: ${missing.join(', ')}`)

    const updates = rows.flatMap((row) => {
      const want = wanted.find((item) => item.slug === row.slug)
      if (!want) return []
      const data: { name?: string; shortDescription?: string | null } = {}
      if (row.name !== want.name) {
        console.log(`• ${row.slug}: название «${row.name}» → «${want.name}»`)
        data.name = want.name
      }
      if (row.shortDescription !== want.shortDescription) {
        console.log(`• ${row.slug}: описание «${row.shortDescription}» → «${want.shortDescription}»`)
        data.shortDescription = want.shortDescription
      }
      return Object.keys(data).length > 0 ? [{ id: row.id, data }] : []
    })

    const ingredientRows = await prisma.product.findMany({
      where: { slug: { in: isseimi.map((item) => item.slug) } },
      select: {
        id: true,
        slug: true,
        ingredients: { orderBy: { sortOrder: 'asc' }, select: { ingredient: { select: { name: true } } } },
      },
    })
    const plans: IngredientPlan[] = []
    for (const product of isseimi) {
      const row = ingredientRows.find((item) => item.slug === product.slug)
      if (!row) throw new Error(`нет в базе (состав): ${product.slug}`)
      const before = row.ingredients.map((item) => item.ingredient.name)
      if (sameList(before, product.ingredients)) continue
      console.log(`• ${product.slug}: состав «${before.join(', ')}» → «${product.ingredients.join(', ')}»`)
      plans.push({ productId: row.id, before, after: product.ingredients })
    }

    const names = [...new Set(plans.flatMap((plan) => plan.after))]
    const existing = await prisma.ingredient.findMany({ where: { name: { in: names } }, select: { name: true } })
    const created = names.filter((name) => !existing.some((item) => item.name === name))
    for (const name of created) console.log(`• новый ингредиент: «${name}» (slug ${slugify(name)})`)

    console.log(`\nИтог: названия и описания ${updates.length}, состав ${plans.length} товаров, новых ингредиентов ${created.length}`)

    if (!apply) {
      console.log('\nСухой прогон: ничего не записано. Для записи — с флагом --apply.')
      return
    }

    await prisma.$transaction(
      async (tx) => {
        for (const update of updates) {
          await tx.product.update({ where: { id: update.id }, data: update.data })
        }
        for (const plan of plans) {
          await tx.productIngredient.deleteMany({ where: { productId: plan.productId } })
          for (const [i, name] of plan.after.entries()) {
            const ingredient = await tx.ingredient.upsert({
              where: { name },
              update: {},
              create: { name, slug: slugify(name) },
            })
            await tx.productIngredient.create({
              data: { productId: plan.productId, ingredientId: ingredient.id, isKey: i < 3, sortOrder: i },
            })
          }
        }
      },
      { timeout: 60_000 },
    )
    console.log(`Обновлено: названия и описания ${updates.length}, состав ${plans.length}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Ошибка:', error instanceof Error ? error.message : error)
  process.exit(1)
})
