import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { recalcProductPrices } from '../src/services/product-prices.js'
import {
  parseRetailProductsFile,
  planRetailProduct,
  type RetailPlan,
  type RetailPlanContext,
} from '../src/lib/import-retail-products.plan.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()

async function loadContext(): Promise<RetailPlanContext> {
  const [categories, brands, lines, products] = await Promise.all([
    prisma.category.findMany({ select: { id: true, slug: true } }),
    prisma.brand.findMany({ select: { id: true, slug: true } }),
    prisma.productLine.findMany({ select: { id: true, slug: true } }),
    prisma.product.findMany({ select: { id: true, slug: true } }),
  ])
  return {
    categories: new Map(categories.map((c) => [c.slug, c.id])),
    brands: new Map(brands.map((b) => [b.slug, b.id])),
    lines: new Map(lines.map((l) => [l.slug, l.id])),
    products: new Map(products.map((p) => [p.slug, p.id])),
  }
}

function printPlan(plans: RetailPlan[]): void {
  for (const plan of plans) {
    if (plan.kind === 'exists') {
      console.log(`  [пропуск] ${plan.slug} — товар уже есть`)
    } else {
      console.log(`  [создать] ${plan.slug} — ${plan.variant.volumeLabel}, розница ${plan.variant.retailPrice / 100} ₽`)
    }
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  console.log(`Режим: ${apply ? 'ЗАПИСЬ В БАЗУ' : 'сухой прогон'}`)

  const file = parseRetailProductsFile(
    JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/retail-products.json'), 'utf-8')),
  )
  const ctx = await loadContext()
  const plans = file.products.map((item) => planRetailProduct(item, ctx))
  printPlan(plans)

  const creates = plans.filter((plan) => plan.kind === 'create')
  console.log(`\nИтог: создать ${creates.length}, пропустить ${plans.length - creates.length}`)

  if (!apply) {
    console.log('\nСухой прогон: ничего не записано. Для записи — с флагом --apply.')
    return
  }

  await prisma.$transaction(async (tx) => {
    for (const plan of plans) {
      if (plan.kind !== 'create') continue
      const created = await tx.product.create({ data: plan.product })
      await tx.productCategory.create({
        data: { productId: created.id, categoryId: plan.categoryId },
      })
      await tx.productVariant.create({
        data: { ...plan.variant, productId: created.id },
      })
    }
    await recalcProductPrices(tx)
  })

  console.log('\nЗаписано.')
}

main()
  .catch((error: unknown) => {
    console.error('Ошибка:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
