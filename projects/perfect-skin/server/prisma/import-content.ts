import { PrismaClient, Prisma } from '../../../../node_modules/.prisma/ps-client/index.js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import {
  parseDetailsFile,
  planProductContent,
  type CurrentContent,
  type DetailsFile,
  type FieldPlan,
  type ProductContentPlan,
} from '../src/lib/import-content.plan.js'
import { syncedText, textLimitIssue, type ProductDetails } from '../src/lib/product-details.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_DIR = path.join(__dirname, '../assets/product-details')
const SNAPSHOT_WARN_BYTES = 1024 * 1024

const FIELD_LABEL = { details: 'карточка', description: 'описание', usage: 'применение' } as const

interface SnapshotDetail {
  slug: string
  description: string
  usage: string | null
  details?: unknown
  [key: string]: unknown
}

interface CatalogSnapshot {
  products: Array<{ detail: SnapshotDetail; meta: unknown }>
  [key: string]: unknown
}

interface ProductRow extends CurrentContent {
  id: string
  slug: string
}

function argValue(name: string): string | undefined {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
}

function loadDetailFiles(dir: string): DetailsFile[] {
  const names = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json') && !name.startsWith('_'))
    .sort()
  const files = names.map((name) => {
    let json: unknown
    try {
      json = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8'))
    } catch {
      throw new Error(`${name}: файл не читается как JSON`)
    }
    const file = parseDetailsFile(name, json)
    const limit = textLimitIssue(syncedText(file.details))
    if (limit) throw new Error(`${name}: ${limit}`)
    return file
  })
  const slugs = files.map((file) => file.slug)
  const duplicate = slugs.find((slug, index) => slugs.indexOf(slug) !== index)
  if (duplicate) throw new Error(`повтор slug в каталоге карточек: ${duplicate}`)
  return files
}

function planFile(file: DetailsFile, current: CurrentContent): ProductContentPlan {
  try {
    return planProductContent(current, file.details)
  } catch (error) {
    throw new Error(`${file.slug}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function describeField(field: FieldPlan): string {
  const label = FIELD_LABEL[field.field]
  if (field.state === 'not-in-card') return `${label}: в карточке нет, не трогаем`
  if (field.state === 'same') return `${label}: без изменений`
  if (field.field === 'details') return `${label}: изменится`
  return `${label}: было ${field.oldLength} знаков → станет ${field.newLength} знаков`
}

function printPlan(slug: string, fields: FieldPlan[]): void {
  console.log(`\n• ${slug}`)
  for (const field of fields) console.log(`    ${describeField(field)}`)
}

async function runDb(prisma: PrismaClient, files: DetailsFile[], apply: boolean): Promise<void> {
  const rows: ProductRow[] = await prisma.product.findMany({
    where: { deletedAt: null, slug: { in: files.map((file) => file.slug) } },
    select: { id: true, slug: true, details: true, description: true, usage: true },
  })
  const bySlug = new Map<string, ProductRow[]>()
  for (const row of rows) bySlug.set(row.slug, [...(bySlug.get(row.slug) ?? []), row])

  const notFound: string[] = []
  const ambiguous: string[] = []
  const updates: Array<{ id: string; slug: string; data: ProductContentPlan['data'] }> = []
  const fieldCounts = { details: 0, description: 0, usage: 0 }
  let unchanged = 0

  for (const file of files) {
    const found = bySlug.get(file.slug) ?? []
    if (found.length === 0) {
      notFound.push(file.slug)
      continue
    }
    if (found.length > 1) {
      ambiguous.push(file.slug)
      continue
    }

    const plan = planFile(file, found[0])
    const changed = plan.fields.filter((field) => field.state === 'changed')
    for (const field of changed) fieldCounts[field.field]++
    if (changed.length === 0) {
      unchanged++
      continue
    }
    printPlan(file.slug, plan.fields)
    updates.push({ id: found[0].id, slug: file.slug, data: plan.data })
  }

  const fieldsTotal = fieldCounts.details + fieldCounts.description + fieldCounts.usage
  const withoutCard = await prisma.product.count({
    where: { deletedAt: null, details: { equals: Prisma.DbNull } },
  })

  console.log('\nИтог:')
  console.log(`  Файлов карточек: ${files.length}`)
  console.log(`  Найдено в базе: ${files.length - notFound.length - ambiguous.length}`)
  console.log(`  Не найдено: ${notFound.length}${notFound.length ? ` — ${notFound.join(', ')}` : ''}`)
  console.log(`  Неоднозначно: ${ambiguous.length}${ambiguous.length ? ` — ${ambiguous.join(', ')}` : ''}`)
  console.log(`  Товаров к изменению: ${updates.length}, без изменений: ${unchanged}`)
  console.log(
    `  Полей к изменению: ${fieldsTotal} (карточка: ${fieldCounts.details}, описание: ${fieldCounts.description}, применение: ${fieldCounts.usage})`,
  )
  console.log(`  В базе без карточки (details IS NULL, не удалённые): ${withoutCard}`)

  if (!apply) {
    console.log('\nСухой прогон: ничего не записано. Для записи — с флагом --apply.')
    return
  }

  await prisma.$transaction(
    async (tx) => {
      for (const update of updates) {
        await tx.product.update({
          where: { id: update.id },
          data: {
            details: update.data.details as Prisma.InputJsonValue | undefined,
            description: update.data.description,
            usage: update.data.usage,
          },
        })
      }
    },
    { timeout: 60_000 },
  )
  console.log(`\nОбновлено товаров: ${updates.length}`)
}

function withSnapshotDetails(detail: SnapshotDetail, details: ProductDetails | null, text: ProductContentPlan['data']): SnapshotDetail {
  const ordered: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(detail)) {
    if (key === 'details') continue
    ordered[key] = value
    if (key === 'description') ordered.details = details
  }
  if (!('details' in ordered)) ordered.details = details
  if (text.description !== undefined) ordered.description = text.description
  if (text.usage !== undefined) ordered.usage = text.usage
  return ordered as SnapshotDetail
}

function runSnapshot(snapshotPath: string, files: DetailsFile[]): void {
  const raw = fs.readFileSync(snapshotPath, 'utf-8')
  const snapshot = JSON.parse(raw) as CatalogSnapshot
  const fileBySlug = new Map(files.map((file) => [file.slug, file]))
  const matchedSlugs = new Set<string>()
  let withCard = 0
  let descriptionChanged = 0
  let usageChanged = 0

  snapshot.products = snapshot.products.map((product) => {
    const file = fileBySlug.get(product.detail.slug)
    if (!file) return { ...product, detail: withSnapshotDetails(product.detail, null, {}) }

    matchedSlugs.add(file.slug)
    withCard++
    const plan = planFile(file, {
      details: product.detail.details ?? null,
      description: product.detail.description,
      usage: product.detail.usage,
    })
    if (plan.fields.find((field) => field.field === 'description')?.state === 'changed') descriptionChanged++
    if (plan.fields.find((field) => field.field === 'usage')?.state === 'changed') usageChanged++
    return { ...product, detail: withSnapshotDetails(product.detail, file.details, plan.data) }
  })

  const unmatched = files.filter((file) => !matchedSlugs.has(file.slug)).map((file) => file.slug)
  const body = JSON.stringify(snapshot)
  fs.writeFileSync(snapshotPath, body)

  console.log(`Снимок: ${snapshot.products.length} товаров, с карточкой: ${withCard}, без карточки: ${snapshot.products.length - withCard}`)
  console.log(`  Описание изменено: ${descriptionChanged}, применение изменено: ${usageChanged}`)
  console.log(`  Файлов без товара в снимке: ${unmatched.length}${unmatched.length ? ` — ${unmatched.join(', ')}` : ''}`)
  const before = Buffer.byteLength(raw)
  const after = Buffer.byteLength(body)
  console.log(`  Размер: ${before} → ${after} байт (${after - before >= 0 ? '+' : ''}${after - before})`)
  if (after > SNAPSHOT_WARN_BYTES) {
    console.log('  ВНИМАНИЕ: снимок больше 1 МБ — стоит вынести карточки в отдельные файлы.')
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const snapshotArg = argValue('snapshot')
  if (snapshotArg && apply) throw new Error('--snapshot и --apply не вместе: снимок пишется сразу')

  const dir = path.resolve(argValue('dir') ?? DEFAULT_DIR)
  const files = loadDetailFiles(dir)
  console.log(`Карточки: ${files.length} файлов из ${dir}`)

  if (snapshotArg) {
    runSnapshot(path.resolve(snapshotArg), files)
    return
  }

  console.log(`Режим: ${apply ? 'ЗАПИСЬ В БАЗУ' : 'сухой прогон'}`)
  const prisma = new PrismaClient()
  try {
    await runDb(prisma, files, apply)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Ошибка:', error instanceof Error ? error.message : error)
  process.exit(1)
})
