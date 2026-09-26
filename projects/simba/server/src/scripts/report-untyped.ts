// Только чтение: почему товары не попадают ни в один тип дерева категорий.
// Делит «без типа» на группы и смотрит, хранит ли МойСклад формат корма
// (в пути папки или в доп. полях) — до того, как решать, откуда его брать.
import { PrismaClient } from '@prisma/client'
import { classifyType } from '../lib/product-type.js'
import { fetchAssortment } from '../services/moysklad/client.js'

const prisma = new PrismaClient()
const SAMPLE = 15

const WET = /влажн|консерв|пауч|паштет|в желе|в соусе|кусочки в|рагу|мусс/i
const DRY = /сух(ой|ого|ие|их)|сух\./i
const MEDICAL = /vet ?diet|vetdiet|vet life|prescription|renal|gastro|urinary|hepatic|intestinal|diabet|obesity|satiety|recovery|cardiac|mobility|derma|struvite/i
const CARE = /бальзам|кондиционер/i
const FORMAT = /сух|влаж|консерв|пауч/i

type Row = {
  id: string
  meta: { type: string }
  pathName?: string
  product?: { meta?: { href?: string } }
  attributes?: Array<{ name?: string; value?: unknown }>
}

function productIdFromHref(href: string | undefined): string | null {
  const m = href?.match(/\/entity\/product\/([0-9a-f-]{36})/)
  return m ? m[1] : null
}

function printGroup(title: string, names: string[]) {
  console.log(`\n--- ${title}: ${names.length} ---`)
  for (const n of names.slice(0, SAMPLE)) console.log(`  • ${n.slice(0, 80)}`)
  if (names.length > SAMPLE) console.log(`  … ещё ${names.length - SAMPLE}`)
}

async function loadMoysklad(): Promise<Map<string, Row> | null> {
  if (!process.env.MOYSKLAD_TOKEN) {
    console.log('МойСклад: токена нет — часть отчёта про МойСклад пропущена')
    return null
  }
  try {
    const rows = (await fetchAssortment()) as Row[]
    return new Map(rows.map((r) => [r.id, r]))
  } catch (err) {
    console.log(`МойСклад: ошибка загрузки (${err instanceof Error ? err.message : String(err)})`)
    return null
  }
}

function folderOf(row: Row, byId: Map<string, Row>): string | null {
  if (row.meta.type === 'variant') {
    const parentId = productIdFromHref(row.product?.meta?.href)
    const parent = parentId ? byId.get(parentId) : undefined
    return parent?.pathName ?? row.pathName ?? null
  }
  return row.pathName ?? null
}

function attrsOf(row: Row, byId: Map<string, Row>): Array<{ name: string; value: string }> {
  const own = row.attributes ?? []
  const parentId = row.meta.type === 'variant' ? productIdFromHref(row.product?.meta?.href) : null
  const inherited = parentId ? byId.get(parentId)?.attributes ?? [] : []
  return [...own, ...inherited].map((a) => ({
    name: String(a.name ?? ''),
    value: typeof a.value === 'object' && a.value !== null
      ? String((a.value as { name?: string }).name ?? JSON.stringify(a.value))
      : String(a.value ?? ''),
  }))
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      species: true,
      quizTags: true,
      autoQuizTags: true,
      variants: { select: { moyskladId: true } },
      filterValues: { select: { filterValueId: true } },
    },
  })

  const untyped = products.filter((p) => !classifyType(p) || p.species === 'unknown')
  console.log('════════ ТОВАРЫ БЕЗ ТИПА (только чтение) ════════')
  console.log(`Всего товаров: ${products.length}, без типа: ${untyped.length}`)
  console.log(`Из них без характеристик первичного импорта: ${untyped.filter((p) => p.filterValues.length === 0).length}`)

  const wet: string[] = []
  const dry: string[] = []
  const both: string[] = []
  const medical: string[] = []
  const care: string[] = []
  const rest: string[] = []
  for (const p of untyped) {
    const w = WET.test(p.name)
    const d = DRY.test(p.name)
    if (MEDICAL.test(p.name)) medical.push(p.name)
    else if (CARE.test(p.name)) care.push(p.name)
    else if (w && d) both.push(p.name)
    else if (w) wet.push(p.name)
    else if (d) dry.push(p.name)
    else rest.push(p.name)
  }

  printGroup('Лечебные линейки (не в MEDICAL_LINES)', medical)
  printGroup('Уход: бальзам / кондиционер', care)
  printGroup('Влажный — по названию', wet)
  printGroup('Сухой — по названию', dry)
  printGroup('Оба словаря сразу — спорные', both)
  console.log(`\n--- Остальное (корм без слов о формате + аксессуары): ${rest.length} ---`)
  for (const n of rest) console.log(`  • ${n.slice(0, 80)}`)

  const ms = await loadMoysklad()
  if (!ms) return

  const folderCounts = new Map<string, number>()
  const attrNames = new Map<string, number>()
  const formatAttrs = new Map<string, number>()
  let linked = 0
  let folderHasFormat = 0
  for (const p of untyped) {
    const row = p.variants.map((v) => (v.moyskladId ? ms.get(v.moyskladId) : undefined)).find(Boolean)
    if (!row) continue
    linked++
    const folder = folderOf(row, ms)
    if (folder) {
      folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1)
      if (FORMAT.test(folder)) folderHasFormat++
    }
    for (const a of attrsOf(row, ms)) {
      attrNames.set(a.name, (attrNames.get(a.name) ?? 0) + 1)
      if (FORMAT.test(a.value)) {
        const key = `${a.name} = ${a.value}`
        formatAttrs.set(key, (formatAttrs.get(key) ?? 0) + 1)
      }
    }
  }

  const allNames = new Set<string>()
  for (const row of ms.values()) for (const a of row.attributes ?? []) allNames.add(String(a.name ?? ''))

  console.log('\n════════ МОЙСКЛАД ════════')
  console.log(`Позиций в МоемСкладе: ${ms.size}`)
  console.log(`Товаров без типа, привязанных к МоемуСкладу: ${linked} из ${untyped.length}`)
  console.log(`Папка содержит «сух/влаж/консерв/пауч»: ${folderHasFormat}`)
  console.log(`Доп. поля во всём МоемСкладе: ${[...allNames].filter(Boolean).join(', ') || 'нет'}`)
  console.log(`Доп. поля у товаров без типа: ${[...attrNames.entries()].map(([n, c]) => `${n} (${c})`).join(', ') || 'нет'}`)
  console.log(`Значения с форматом в доп. полях: ${[...formatAttrs.entries()].map(([k, c]) => `${k} (${c})`).join('; ') || 'нет'}`)
  console.log('\nПапки товаров без типа:')
  for (const [f, c] of [...folderCounts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(4)}  ${f}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
