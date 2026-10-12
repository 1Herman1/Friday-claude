import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { recalcProductPrices } from '../src/services/product-prices.js'
import {
  parseDiscontinuedFile,
  planDiscontinue,
  type PlanProduct,
  type ReportItem,
} from '../src/lib/discontinue.plan.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()

const STATUS_LABEL: Record<ReportItem['status'], string> = {
  to_change: 'изменится',
  already: 'уже снят',
  not_found: 'не найдено',
  ambiguous: 'неоднозначно',
}

async function loadRows(slugs: string[]): Promise<PlanProduct[]> {
  const rows = await prisma.product.findMany({
    where: { slug: { in: slugs }, deletedAt: null },
    select: {
      id: true,
      slug: true,
      isActive: true,
      isProfessional: true,
      popularPin: true,
      _count: { select: { cartItems: true } },
      variants: {
        where: { deletedAt: null },
        select: {
          id: true,
          volumeValue: true,
          isActive: true,
          isProfessional: true,
          _count: { select: { cartItems: true } },
        },
      },
    },
  })
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    isActive: row.isActive,
    isProfessional: row.isProfessional,
    popularPin: row.popularPin,
    cartItemCount: row._count.cartItems,
    variants: row.variants.map((v) => ({
      id: v.id,
      volumeValue: Number(v.volumeValue),
      isActive: v.isActive,
      isProfessional: v.isProfessional,
      cartItemCount: v._count.cartItems,
    })),
  }))
}

function printItems(title: string, items: ReportItem[]): void {
  console.log(`\n${title}:`)
  for (const item of items) {
    console.log(`  [${STATUS_LABEL[item.status]}] ${item.label} — ${item.note}`)
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  console.log(`Режим: ${apply ? 'ЗАПИСЬ В БАЗУ' : 'сухой прогон'}`)

  const file = parseDiscontinuedFile(
    JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/discontinued.json'), 'utf-8')),
  )
  const slugs = [...new Set([...file.products, ...file.variants.map((v) => v.product)])]
  const plan = planDiscontinue(file, await loadRows(slugs))

  printItems('Товары', plan.items.filter((item) => item.kind === 'product'))
  printItems('Фасовки', plan.items.filter((item) => item.kind === 'variant'))
  for (const warning of plan.warnings) console.log(`  Предупреждение: ${warning}`)

  const { totals } = plan
  console.log(
    `\nИтог: товаров к снятию ${totals.products}, фасовок к отключению ${totals.variants}, ` +
      `позиций корзин к удалению ${totals.cartItems}, popularPin к снятию ${totals.popularPins}, ` +
      `isProfessional к пересчёту ${totals.professional}`,
  )

  if (!apply) {
    console.log('\nСухой прогон: ничего не записано. Для записи — с флагом --apply.')
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.cartItem.deleteMany({
      where: {
        OR: [
          { productId: { in: plan.cartDelete.productIds } },
          { productVariantId: { in: plan.cartDelete.variantIds } },
        ],
      },
    })
    await tx.product.updateMany({
      where: { id: { in: plan.productIds } },
      data: { isActive: false, popularPin: null },
    })
    await tx.productVariant.updateMany({
      where: { id: { in: plan.variantIds } },
      data: { isActive: false },
    })
    for (const update of plan.professional) {
      await tx.product.update({
        where: { id: update.productId },
        data: { isProfessional: update.isProfessional },
      })
    }
    for (const productId of plan.recalcProductIds) {
      await recalcProductPrices(tx, productId)
    }
  })

  console.log('\nЗаписано.')
}

main()
  .catch((error: unknown) => {
    console.error('Ошибка:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
