import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import {
  ContentFileSchema,
  planProductText,
  type FieldPlan,
  type ProductTextFields,
} from '../src/lib/import-content.plan.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()
const DEFAULT_FILE = path.join(__dirname, '../../../../docs/projects/perfect-skin/content/client-isseimi.json')

interface PlannedProduct {
  id: string
  slug: string
  data: Partial<ProductTextFields>
}

function printField(plan: FieldPlan): void {
  if (!plan.inFile) {
    console.log(`    ${plan.field}: нет в файле — не трогаем`)
  } else if (!plan.changed) {
    console.log(`    ${plan.field}: без изменений (${plan.oldLength} знаков)`)
  } else {
    console.log(`    ${plan.field}: было ${plan.oldLength} знаков → станет ${plan.newLength} знаков`)
  }
}

async function run() {
  const dryRun = !process.argv.includes('--apply')
  const fileArg = process.argv.find((arg) => arg.startsWith('--file='))
  const filePath = fileArg ? fileArg.substring(7) : DEFAULT_FILE

  console.log(`\n📖 Loading content from: ${path.basename(filePath)}`)
  console.log(`Mode: ${dryRun ? 'DRY RUN (preview)' : 'APPLY (writing to DB)'}`)

  const items = ContentFileSchema.parse(JSON.parse(fs.readFileSync(filePath, 'utf-8')))
  const slugs = items.map((item) => item.slug)
  const duplicate = slugs.find((slug, index) => slugs.indexOf(slug) !== index)
  if (duplicate) throw new Error(`Повтор slug в файле: ${duplicate}`)

  const planned: PlannedProduct[] = []
  const notFound: string[] = []
  const ambiguous: string[] = []
  const fieldCounts: Record<keyof ProductTextFields, number> = { description: 0, usage: 0, inciText: 0 }

  for (const item of items) {
    const found = await prisma.product.findMany({
      where: { slug: item.slug, deletedAt: null },
      select: { id: true, description: true, usage: true, inciText: true },
    })
    if (found.length === 0) {
      notFound.push(item.slug)
      continue
    }
    if (found.length > 1) {
      ambiguous.push(item.slug)
      continue
    }

    const plan = planProductText(item, found[0])
    console.log(`\n• ${item.slug}`)
    plan.fields.forEach(printField)

    for (const field of plan.fields) {
      if (field.changed) fieldCounts[field.field]++
    }
    if (Object.keys(plan.data).length > 0) {
      planned.push({ id: found[0].id, slug: item.slug, data: plan.data })
    }
  }

  const changedFields = Object.values(fieldCounts).reduce((sum, n) => sum + n, 0)
  console.log('\n📊 Итог:')
  console.log(`  Товаров в файле: ${items.length}`)
  console.log(`  Найдено в базе: ${items.length - notFound.length - ambiguous.length}`)
  console.log(`  Не найдено: ${notFound.length}${notFound.length ? ` — ${notFound.join(', ')}` : ''}`)
  console.log(`  Неоднозначно (больше одного товара с таким slug): ${ambiguous.length}${ambiguous.length ? ` — ${ambiguous.join(', ')}` : ''}`)
  console.log(`  Товаров к изменению: ${planned.length}`)
  console.log(`  Полей к изменению: ${changedFields} (description: ${fieldCounts.description}, usage: ${fieldCounts.usage}, inciText: ${fieldCounts.inciText})`)

  if (dryRun) {
    console.log('\n💡 Сухой прогон: ничего не записано. Для записи — с флагом --apply.')
    return
  }

  await prisma.$transaction(async (tx) => {
    for (const product of planned) {
      await tx.product.update({ where: { id: product.id }, data: product.data })
    }
  })
  console.log(`\n✅ Обновлено товаров: ${planned.length}`)
}

run()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
