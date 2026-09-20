/**
 * Разведка: подсказывают ли папки МоегоСклада вид животного.
 *
 * У ста товаров вид не определяется по названию («Hill's k/d Kidney Care» есть
 * и кошачий, и собачий). Но каждый из них привязан к МоемуСкладу, а там товары
 * лежат по папкам (pathName — полный путь вроде «Корма/Кошки/Сухие»). Если
 * владелец ведёт папки по видам, разметка закрывается данными, а не догадками.
 *
 * Скрипт только читает: ассортимент МоегоСклада одним проходом и нашу базу.
 * Печатает, в каких папках лежат уже размеченные товары (проверка, что папка
 * вообще коррелирует с видом) и папку каждого неразмеченного.
 *
 *   npx tsx --env-file=.env src/scripts/moysklad-species-probe.ts
 */
import { PrismaClient } from '@prisma/client'
import { fetchAssortment } from '../services/moysklad/client.js'

const prisma = new PrismaClient()

// Поля ассортимента, которых нет в общем типе: путь папки у товара и ссылка на
// родительский товар у модификации (у модификации своей папки нет).
type AssortmentRow = {
  id: string
  meta: { type: string }
  name: string
  pathName?: string
  product?: { meta?: { href?: string } }
}

function productIdFromHref(href: string | undefined): string | null {
  if (!href) return null
  const match = href.match(/\/entity\/product\/([0-9a-f-]{36})/)
  return match ? match[1] : null
}

function tally(values: Array<string | null>): Array<[string, number]> {
  const counts = new Map<string, number>()
  for (const value of values) {
    const key = value ?? '(нет папки)'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

async function main() {
  if (!process.env.MOYSKLAD_TOKEN) {
    console.log('MOYSKLAD_TOKEN не задан — разведка невозможна.')
    return
  }

  const rows = (await fetchAssortment()) as AssortmentRow[]
  const byId = new Map(rows.map((row) => [row.id, row]))

  // Папка позиции: у товара своя, у модификации — родительского товара.
  const folderOf = (moyskladId: string): string | null => {
    const row = byId.get(moyskladId)
    if (!row) return null
    if (row.meta.type === 'variant') {
      const parentId = productIdFromHref(row.product?.meta?.href)
      const parent = parentId ? byId.get(parentId) : undefined
      return parent?.pathName ?? row.pathName ?? null
    }
    return row.pathName ?? null
  }

  const products = await prisma.product.findMany({
    where: { variants: { some: { moyskladId: { not: null } } } },
    select: {
      id: true,
      name: true,
      species: true,
      variants: { where: { moyskladId: { not: null } }, select: { moyskladId: true }, take: 1 },
    },
    orderBy: { name: 'asc' },
  })

  const withFolder = products.map((p) => ({
    ...p,
    folder: folderOf(p.variants[0]?.moyskladId ?? ''),
  }))

  console.log(`Позиций в ассортименте МоегоСклада: ${rows.length}`)
  console.log(`Товаров с привязкой у нас: ${products.length}\n`)

  for (const species of ['cat', 'dog', 'both'] as const) {
    const group = withFolder.filter((p) => p.species === species)
    if (group.length === 0) continue
    console.log(`=== Уже размечены как ${species} (${group.length}) — в каких папках лежат ===`)
    for (const [folder, count] of tally(group.map((p) => p.folder))) {
      console.log(`  ${String(count).padStart(4)}  ${folder}`)
    }
    console.log()
  }

  const unknown = withFolder.filter((p) => p.species === 'unknown')
  console.log(`=== Не размечены (${unknown.length}) — распределение по папкам ===`)
  for (const [folder, count] of tally(unknown.map((p) => p.folder))) {
    console.log(`  ${String(count).padStart(4)}  ${folder}`)
  }
  console.log()

  console.log('=== Не размечены — по товарам ===')
  for (const p of unknown) {
    console.log(`  ${p.folder ?? '(нет папки)'}  |  ${p.name}`)
  }
}

main()
  .catch((err) => {
    console.error('probe failed:', err instanceof Error ? err.message : String(err))
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
