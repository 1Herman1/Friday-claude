import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

// Названия и короткие описания после сверки с INCI (27.10.2026); сид товары существующие не трогает, поэтому обновляем разово
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CATALOG_FILE = path.join(__dirname, '../assets/catalog-curated.json')
const SLUGS = [
  'tts-energizing-mask-maska-so-stvolovymi-kletkami',
  'scrub-lotion-krem-dlya-snyatiya-makiyazha',
  '3-flower-serum-multi-uvlazhnyayushhaya-syvorotka',
  'tts-moisturizing-mask-uvlazhnyayushhaya-maska',
] as const

interface CatalogProduct {
  slug: string
  name: string
  action: string | null
}

interface Wanted {
  slug: string
  name: string
  shortDescription: string | null
}

function wantedFrom(product: CatalogProduct): Wanted {
  return {
    slug: product.slug,
    name: product.name,
    shortDescription: product.action ? product.action.split('.')[0].slice(0, 160) : null,
  }
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
    console.log(`\nИтог: к изменению ${updates.length}`)

    if (!apply) {
      console.log('\nСухой прогон: ничего не записано. Для записи — с флагом --apply.')
      return
    }

    await prisma.$transaction(updates.map((update) => prisma.product.update({ where: { id: update.id }, data: update.data })))
    console.log(`Обновлено: ${updates.length}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Ошибка:', error instanceof Error ? error.message : error)
  process.exit(1)
})
