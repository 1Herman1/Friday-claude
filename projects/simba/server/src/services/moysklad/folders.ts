import { fetchAssortment } from './client.js'

type Row = {
  id: string
  meta: { type: string }
  pathName?: string
  product?: { meta?: { href?: string } }
}

function productIdFromHref(href: string | undefined): string | null {
  const match = href?.match(/\/entity\/product\/([0-9a-f-]{36})/)
  return match ? match[1] : null
}

/**
 * Путь папки МоегоСклада для каждой позиции ассортимента (ключ — id позиции,
 * он же Variant.moyskladId). У модификации своей папки нет — берётся папка
 * родительского товара. null — токена нет или МойСклад не ответил: вызывающий
 * решает сам, работать ли без папок.
 */
export async function loadMoyskladFolders(): Promise<Map<string, string> | null> {
  if (!process.env.MOYSKLAD_TOKEN) {
    console.warn('⚠️  MOYSKLAD_TOKEN не задан — папки МоегоСклада не будут использованы')
    return null
  }
  try {
    const rows = (await fetchAssortment()) as Row[]
    const byId = new Map(rows.map((row) => [row.id, row]))
    const folders = new Map<string, string>()
    for (const row of rows) {
      const parentId = row.meta.type === 'variant' ? productIdFromHref(row.product?.meta?.href) : null
      const path = (parentId ? byId.get(parentId)?.pathName : undefined) ?? row.pathName
      if (path) folders.set(row.id, path)
    }
    console.log(`📁 Папки МоегоСклада: путь есть у ${folders.size} из ${rows.length} позиций`)
    return folders
  } catch (err) {
    console.warn(`⚠️  Ошибка загрузки МоегоСклада (${err instanceof Error ? err.message : String(err)}) — папки не будут использованы`)
    return null
  }
}
