import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import {
  InciFileSchema,
  planInci,
  type InciChange,
  type InciItem,
  type InciPlan,
} from '../src/lib/import-inci.plan.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INPUT_FILE = path.join(__dirname, '../../../../docs/projects/perfect-skin/content/inci/isseimi.json')

interface CatalogSnapshot {
  products: Array<{ detail: { slug: string; inciText?: string | null; [key: string]: unknown }; meta: unknown }>
  [key: string]: unknown
}

function argValue(name: string): string | undefined {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
}

function loadItems(): InciItem[] {
  return InciFileSchema.parse(JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'))).items
}

function describeChange(change: InciChange): string {
  if (!change.from) return `${change.slug}: пусто → ${change.to.length} символов`
  return `${change.slug}: заменить (было ${change.from.length}, станет ${change.to.length} символов)`
}

function printPlan(plan: InciPlan, scope: string): void {
  for (const change of plan.changes) console.log(`• ${describeChange(change)}`)
  const list = (slugs: string[]): string => (slugs.length ? ` — ${slugs.join(', ')}` : '')
  console.log('\nИтог:')
  console.log(
    `  К установке: ${plan.changes.length} (пусто → заполнить: ${plan.changes.filter((c) => !c.from).length}, заменить: ${plan.changes.filter((c) => c.from).length})`,
  )
  console.log(`  Уже совпадает: ${plan.unchanged.length}`)
  console.log(`  Пропущено по решению клиента: ${plan.skipped.length}`)
  console.log(`  Не найдено ${scope}: ${plan.missing.length}${list(plan.missing)}`)
  console.log(`  Неоднозначно: ${plan.ambiguous.length}${list(plan.ambiguous)}`)
}

async function runDb(prisma: PrismaClient, items: InciItem[], apply: boolean): Promise<void> {
  const products = await prisma.product.findMany({ where: { deletedAt: null }, select: { slug: true, inciText: true } })
  const plan = planInci(items, products)
  printPlan(plan, 'среди живых товаров')

  if (!apply) {
    if (plan.missing.length > 0 || plan.ambiguous.length > 0) {
      console.log('\nВНИМАНИЕ: с --apply запись не начнётся, пока все слаги не найдены однозначно.')
    }
    console.log('\nСухой прогон: ничего не записано. Для записи — с флагом --apply.')
    return
  }

  if (plan.missing.length > 0 || plan.ambiguous.length > 0) {
    throw new Error('не найдены или неоднозначны живые товары — запись отменена, ничего не записано')
  }
  await prisma.$transaction(
    plan.changes.map((change) =>
      prisma.product.updateMany({ where: { slug: change.slug, deletedAt: null }, data: { inciText: change.to } }),
    ),
  )
  console.log(`\nОбновлено товаров: ${plan.changes.length}`)
}

function runSnapshot(snapshotPath: string, items: InciItem[]): void {
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8')) as CatalogSnapshot
  const plan = planInci(
    items,
    snapshot.products.map((product) => ({ slug: product.detail.slug, inciText: product.detail.inciText ?? null })),
  )
  printPlan(plan, 'в снимке')

  const toBySlug = new Map(plan.changes.map((change) => [change.slug, change.to]))
  snapshot.products = snapshot.products.map((product) => {
    const to = toBySlug.get(product.detail.slug)
    return to === undefined ? product : { ...product, detail: { ...product.detail, inciText: to } }
  })
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot))
  console.log(`\nСнимок обновлён: ${snapshotPath}`)
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const snapshotArg = argValue('snapshot')
  if (snapshotArg && apply) throw new Error('--snapshot и --apply не вместе: снимок пишется сразу')

  const items = loadItems()
  console.log(`Решения клиента: ${items.length} позиций из ${INPUT_FILE}`)

  if (snapshotArg) {
    runSnapshot(path.resolve(snapshotArg), items)
    return
  }

  console.log(`Режим: ${apply ? 'ЗАПИСЬ В БАЗУ' : 'сухой прогон'}`)
  const prisma = new PrismaClient()
  try {
    await runDb(prisma, items, apply)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Ошибка:', error instanceof Error ? error.message : error)
  process.exit(1)
})
