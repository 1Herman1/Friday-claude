import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { recalcProductPrices } from '../src/services/product-prices.js'
import {
  parseProProductsFile,
  planNewProduct,
  planVariantForExisting,
  type PlanContext,
  type ProProductsFile,
} from '../src/lib/import-pro-products.plan.js'
import { normalize, replaceCyrillicLookalikes } from '../src/lib/import-prices.match.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()

interface ReportRecord {
  type: 'product' | 'variant'
  article: number
  name: string
  action: 'created' | 'updated' | 'none' | 'error' | 'conflict'
  reason?: string
}

/**
 * Находит товар по названию используя нормализацию (как в import-prices.match.ts).
 * Требует ровно одного кандидата.
 */
type ProductWithVariants = {
  id: string
  name: string
  variants: Array<{
    id: string
    volumeValue: number
    volumeUnit: 'ml' | 'g' | 'pcs'
    externalId: string | null
    wholesalePrice: number | null
    isProfessional: boolean
  }>
}

async function findProductByName(siteName: string): Promise<ProductWithVariants | null> {
  const rows = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      variants: {
        where: { deletedAt: null },
        select: { id: true, volumeValue: true, volumeUnit: true, externalId: true, wholesalePrice: true, isProfessional: true },
      },
    },
  })
  // Decimal из Prisma не сравнить с числом напрямую
  const productsDb: ProductWithVariants[] = rows.map((p) => ({
    ...p,
    variants: p.variants.map((v) => ({ ...v, volumeValue: Number(v.volumeValue) })),
  }))

  const normalized = replaceCyrillicLookalikes(siteName)
  const siteNormalized = normalize(normalized)

  const candidates = productsDb.filter((p) => {
    const pNorm = normalize(replaceCyrillicLookalikes(p.name))
    return pNorm === siteNormalized || pNorm.startsWith(siteNormalized + ' ')
  })

  return candidates.length === 1 ? candidates[0] : null
}

async function run() {
  const dryRun = !process.argv.includes('--apply')
  const fileArg = process.argv.find((arg) => arg.startsWith('--file='))
  const filePath = fileArg ? fileArg.substring(7) : path.join(__dirname, '../assets/pro-products.json')

  console.log(`\n📖 Loading pro products from: ${path.basename(filePath)}`)
  console.log(`Mode: ${dryRun ? 'DRY RUN (preview)' : 'APPLY (writing to DB)'}`)

  // Парсим файл
  let proProductsData: ProProductsFile
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    proProductsData = parseProProductsFile(JSON.parse(fileContent))
  } catch (e) {
    console.error('❌ Failed to parse pro-products.json:', e instanceof Error ? e.message : String(e))
    process.exit(1)
  }

  // Загружаем контекст
  console.log('\n📦 Loading catalog context...')

  const categories = await prisma.category.findMany({ select: { id: true, slug: true, sortOrder: true } })
  const categoriesMap = new Map(categories.map((c) => [c.slug, { id: c.id, maxSortOrder: c.sortOrder }]))

  // Проверяем/создаём категорию pilingi-i-eliksiry
  let pilingiCategoryId: string
  const pilingiCat = await prisma.category.findFirst({
    where: { slug: 'pilingi-i-eliksiry' },
  })

  if (pilingiCat) {
    pilingiCategoryId = pilingiCat.id
    console.log(`  ✓ Category "Пилинги и эликсиры" exists`)
  } else {
    const maskiCat = await prisma.category.findFirst({ where: { slug: 'maski' } })
    const newSortOrder = (maskiCat?.sortOrder ?? Math.max(...Array.from(categoriesMap.values()).map((c) => c.maxSortOrder))) + 1

    if (!dryRun) {
      const created = await prisma.category.create({
        data: {
          name: 'Пилинги и эликсиры',
          slug: 'pilingi-i-eliksiry',
          isActive: true,
          sortOrder: newSortOrder,
        },
      })
      pilingiCategoryId = created.id
    } else {
      pilingiCategoryId = 'DRY_RUN_CATEGORY_ID'
    }
    console.log(
      dryRun
        ? `  ✨ Категория «Пилинги и эликсиры» будет создана (sortOrder ${newSortOrder})`
        : `  ✨ Создана категория «Пилинги и эликсиры» (sortOrder ${newSortOrder})`
    )
    categoriesMap.set('pilingi-i-eliksiry', { id: pilingiCategoryId, maxSortOrder: newSortOrder })
  }

  const brands = await prisma.brand.findMany({ select: { id: true, slug: true } })
  const brandsMap = new Map(brands.map((b) => [b.slug, b.id]))

  const lines = await prisma.productLine.findMany({ select: { id: true, slug: true } })
  const linesMap = new Map(lines.map((l) => [l.slug, l.id]))

  const productsDb = await prisma.product.findMany({
    select: { id: true, slug: true, name: true, variants: { select: { id: true, volumeValue: true, volumeUnit: true, externalId: true } } },
  })
  const productsMap = new Map(productsDb.map((p) => [p.slug, p.id]))

  const ctx: PlanContext = { categories: categoriesMap, brands: brandsMap, lines: linesMap, products: productsMap }

  // Планируем изменения
  console.log('\n🎯 Planning changes...')
  const report: ReportRecord[] = []

  // Процессируем новые товары
  for (const item of proProductsData.products) {
    try {
      const plan = planNewProduct(item, ctx)

      if (plan.kind === 'create') {
        report.push({
          type: 'product',
          article: item.article,
          name: item.name,
          action: 'created',
        })
      } else {
        report.push({
          type: 'product',
          article: item.article,
          name: item.name,
          action: 'none',
          reason: plan.reason,
        })
      }
    } catch (e) {
      report.push({
        type: 'product',
        article: item.article,
        name: item.name,
        action: 'error',
        reason: e instanceof Error ? e.message : String(e),
      })
    }
  }

  // Процессируем фасовки к существующим товарам
  for (const item of proProductsData.variantsForExisting) {
    try {
      const product = await findProductByName(item.siteName)
      if (!product) {
        report.push({
          type: 'variant',
          article: item.article,
          name: item.siteName,
          action: 'error',
          reason: `Товар по siteName "${item.siteName}" не найден или неоднозначен`,
        })
        continue
      }

      const plan = planVariantForExisting(item, product)

      if (plan.kind === 'create') {
        report.push({ type: 'variant', article: item.article, name: item.siteName, action: 'created' })
      } else if (plan.kind === 'update') {
        report.push({ type: 'variant', article: item.article, name: item.siteName, action: 'updated' })
      } else if (plan.kind === 'none') {
        report.push({ type: 'variant', article: item.article, name: item.siteName, action: 'none', reason: plan.reason })
      } else if (plan.kind === 'conflict') {
        report.push({ type: 'variant', article: item.article, name: item.siteName, action: 'conflict', reason: plan.reason })
      }
    } catch (e) {
      report.push({
        type: 'variant',
        article: item.article,
        name: item.siteName,
        action: 'error',
        reason: e instanceof Error ? e.message : String(e),
      })
    }
  }

  // Выводим отчёт
  console.log('\n📊 Report:')
  console.log('┌──────┬─────────┬──────────────────────────────────────┬─────────────────┬──────────────────────┐')
  console.log('│ Type │ Article │ Name                                 │ Action           │ Reason               │')
  console.log('├──────┼─────────┼──────────────────────────────────────┼─────────────────┼──────────────────────┤')

  let counts = { created: 0, updated: 0, none: 0, error: 0, conflict: 0 }

  for (const rec of report) {
    const typeCol = rec.type === 'product' ? 'prod' : 'var'
    const nameCol = rec.name.substring(0, 36).padEnd(36, ' ')
    const actionCol = rec.action.padEnd(15, ' ')
    const reasonCol = rec.reason ? rec.reason.substring(0, 20) : ''
    console.log(`│ ${typeCol.padEnd(4)} │ ${String(rec.article).padEnd(7)} │ ${nameCol} │ ${actionCol} │ ${reasonCol.padEnd(20)} │`)

    if (rec.action === 'created') counts.created++
    else if (rec.action === 'updated') counts.updated++
    else if (rec.action === 'none') counts.none++
    else if (rec.action === 'error') counts.error++
    else if (rec.action === 'conflict') counts.conflict++
  }

  console.log('└──────┴─────────┴──────────────────────────────────────┴─────────────────┴──────────────────────┘')
  console.log(
    `\n📈 Summary: created=${counts.created}, updated=${counts.updated}, none=${counts.none}, errors=${counts.error}, conflicts=${counts.conflict}`
  )

  if (dryRun) {
    console.log('\n💡 Dry run complete. Use --apply to write changes to the database.')
    return
  }

  // APPLY: пишем в БД
  console.log('\n✍️  Applying changes to database...')

  await prisma.$transaction(async (tx) => {
    // Создаём новые товары
    for (const item of proProductsData.products) {
      const plan = planNewProduct(item, ctx)
      if (plan.kind !== 'create') continue

      const created = await tx.product.create({
        data: {
          name: plan.data.name,
          slug: plan.data.slug,
          description: plan.data.description,
          shortDescription: plan.data.shortDescription,
          images: plan.data.images,
          brandId: plan.data.brandId,
          lineId: plan.data.lineId,
          isProfessional: plan.data.isProfessional,
          isActive: plan.data.isActive,
          skinTypes: plan.data.skinTypes,
          concerns: plan.data.concerns,
        },
      })

      // Связываем с категорией
      await tx.productCategory.create({
        data: {
          productId: created.id,
          categoryId: plan.data.categoryId,
        },
      })

      // Создаём основную фасовку
      await tx.productVariant.create({
        data: {
          productId: created.id,
          volumeValue: item.volume.value.toString(),
          volumeUnit: item.volume.unit,
          volumeLabel: item.volume.label,
          retailPrice: item.wholesaleKopecks,
          wholesalePrice: item.wholesaleKopecks,
          isProfessional: true,
          stock: 10,
          externalId: `bmg-${item.article}`,
        },
      })
    }

    // Обновляем/создаём фасовки для существующих товаров
    for (const item of proProductsData.variantsForExisting) {
      const product = await findProductByName(item.siteName)
      if (!product) continue

      const plan = planVariantForExisting(item, product)

      if (plan.kind === 'create') {
        await tx.productVariant.create({
          data: {
            productId: product.id,
            volumeValue: item.volume.value.toString(),
            volumeUnit: item.volume.unit,
            volumeLabel: item.volume.label,
            retailPrice: item.wholesaleKopecks,
            wholesalePrice: item.wholesaleKopecks,
            isProfessional: true,
            stock: 10,
            externalId: `bmg-${item.article}`,
          },
        })
      } else if (plan.kind === 'update') {
        await tx.productVariant.update({
          where: { id: plan.variantId },
          data: {
            wholesalePrice: plan.data.wholesalePrice,
            isProfessional: plan.data.isProfessional,
          },
        })
      }
    }

    // Пересчитываем цены товаров
    await recalcProductPrices(tx)
  })

  console.log('✅ Import completed successfully!')
}

run()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
