// Snapshot mode: resolves the four catalog GET endpoints from a static
// JSON dump instead of the live API. Mirrors server filter/sort/facet
// semantics from server/src/services/catalog.service.ts over 57 items.
import { ApiError } from './api'
import type {
  CategoriesTreeResponse,
  Facets,
  FacetGroup,
  ProductCard,
  ProductCardExtended,
  ProductsListResponse,
} from '@/types/api'

interface SnapshotProduct {
  detail: ProductCardExtended
  meta: { newestRank: number; popularRank: number }
}

interface CatalogSnapshot {
  generatedAt: string
  products: SnapshotProduct[]
  categoriesTree: CategoriesTreeResponse[]
  labels: Record<'categories' | 'brands' | 'lines' | 'needs' | 'skinTypes', Record<string, string>>
}

let cache: Promise<CatalogSnapshot> | null = null

export function loadSnapshot(): Promise<CatalogSnapshot> {
  if (!cache) {
    cache = fetch(`${import.meta.env.BASE_URL}snapshot/catalog.json`).then((res) => {
      if (!res.ok) throw new ApiError(500, 'SNAPSHOT_ERROR', 'Каталог недоступен')
      return res.json()
    })
    cache.catch(() => {
      cache = null
    })
  }
  return cache
}

interface Filters {
  category?: string
  brand: string[]
  line: string[]
  need: string[]
  skin: string[]
  minPrice?: number
  maxPrice?: number
  q?: string
}

function parseFilters(sp: URLSearchParams): Filters {
  const num = (v: string | null) => (v !== null && v !== '' && !isNaN(+v) ? +v : undefined)
  return {
    category: sp.get('category') || undefined,
    brand: sp.getAll('brand'),
    line: sp.getAll('line'),
    need: sp.getAll('need'),
    skin: sp.getAll('skin'),
    minPrice: num(sp.get('minPrice')),
    maxPrice: num(sp.get('maxPrice')),
    q: sp.get('q')?.trim() || undefined,
  }
}

function categorySubtree(tree: CategoriesTreeResponse[], slug: string): Set<string> | null {
  const walk = (nodes: CategoriesTreeResponse[]): CategoriesTreeResponse | null => {
    for (const n of nodes) {
      if (n.slug === slug) return n
      const found = walk(n.children || [])
      if (found) return found
    }
    return null
  }
  const root = walk(tree)
  if (!root) return null
  const out = new Set<string>()
  const queue = [root]
  while (queue.length) {
    const n = queue.shift()!
    out.add(n.slug)
    queue.push(...(n.children || []))
  }
  return out
}

// Server drops brand/line filters whose slugs match nothing — mirror that.
function knownSubset(values: string[], known: Record<string, string>): string[] | null {
  if (values.length === 0) return null
  const hit = values.filter((v) => v in known)
  return hit.length > 0 ? hit : null
}

type Group = 'category' | 'brand' | 'line' | 'need' | 'skin' | 'price' | undefined

function matches(p: SnapshotProduct, f: Filters, snap: CatalogSnapshot, exclude: Group): boolean {
  const d = p.detail
  // Search query: first check
  if (f.q) {
    const q = f.q.toLowerCase()
    const searchableFields = [
      d.name,
      d.shortDescription || '',
      d.description || '',
      d.brand?.name || '',
    ]
    const matches = searchableFields.some(field => field.toLowerCase().includes(q))
    if (!matches) return false
  }
  if (exclude !== 'category' && f.category) {
    const subtree = categorySubtree(snap.categoriesTree, f.category)
    if (subtree && !d.categories.some((c) => subtree.has(c.slug))) return false
  }
  if (exclude !== 'brand') {
    const brands = knownSubset(f.brand, snap.labels.brands)
    if (brands && (!d.brand || !brands.includes(d.brand.slug))) return false
  }
  if (exclude !== 'line') {
    const lines = knownSubset(f.line, snap.labels.lines)
    if (lines && (!d.line || !lines.includes(d.line.slug))) return false
  }
  if (exclude !== 'need' && f.need.length > 0) {
    if (!f.need.some((n) => d.needs.includes(n))) return false
  }
  if (exclude !== 'skin' && f.skin.length > 0) {
    const wanted = [...f.skin, 'all_types']
    if (!wanted.some((s) => d.skinTypes.includes(s))) return false
  }
  if (exclude !== 'price' && (f.minPrice !== undefined || f.maxPrice !== undefined)) {
    const inRange = d.variants.some(
      (v) =>
        (f.minPrice === undefined || v.retailPrice >= f.minPrice) &&
        (f.maxPrice === undefined || v.retailPrice <= f.maxPrice)
    )
    if (!inRange) return false
  }
  return true
}

function sortProducts(items: SnapshotProduct[], sort: string | null): SnapshotProduct[] {
  const byId = (a: SnapshotProduct, b: SnapshotProduct) => a.detail.id.localeCompare(b.detail.id)
  const sorted = [...items]
  if (sort === 'price_asc') {
    sorted.sort((a, b) => a.detail.minPrice - b.detail.minPrice || byId(a, b))
  } else if (sort === 'price_desc') {
    sorted.sort((a, b) => b.detail.minPrice - a.detail.minPrice || byId(a, b))
  } else if (sort === 'popular') {
    sorted.sort((a, b) => a.meta.popularRank - b.meta.popularRank)
  } else {
    sorted.sort((a, b) => a.meta.newestRank - b.meta.newestRank)
  }
  return sorted
}

function pickCard(d: ProductCardExtended): ProductCard {
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    brand: d.brand,
    line: d.line,
    image: d.image,
    skinTypes: d.skinTypes,
    needs: d.needs,
    minPrice: d.minPrice,
    oldPrice: d.oldPrice,
    inStock: d.inStock,
    variants: d.variants,
  }
}

function computeList(sp: URLSearchParams, snap: CatalogSnapshot): ProductsListResponse {
  const f = parseFilters(sp)
  const limit = Math.min(Math.max(parseInt(sp.get('limit') || '24', 10) || 24, 1), 60)
  const offset = Math.max(parseInt(sp.get('offset') || '0', 10) || 0, 0)
  const matched = snap.products.filter((p) => matches(p, f, snap, undefined))
  const sorted = sortProducts(matched, sp.get('sort'))
  return {
    items: sorted.slice(offset, offset + limit).map((p) => pickCard(p.detail)),
    total: matched.length,
    limit,
    offset,
  }
}

function toGroups(counts: Map<string, number>, labels: Record<string, string>): FacetGroup[] {
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, label: labels[value] || value, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function computeFacets(sp: URLSearchParams, snap: CatalogSnapshot): Facets {
  const f = parseFilters(sp)
  const count = (exclude: Group, key: (p: SnapshotProduct) => string[]) => {
    const map = new Map<string, number>()
    for (const p of snap.products) {
      if (!matches(p, f, snap, exclude)) continue
      for (const v of key(p)) map.set(v, (map.get(v) || 0) + 1)
    }
    return map
  }

  const priceItems = snap.products.filter((p) => matches(p, f, snap, 'price'))
  let min = Infinity
  let max = 0
  for (const p of priceItems) {
    for (const v of p.detail.variants) {
      min = Math.min(min, v.retailPrice)
      max = Math.max(max, v.retailPrice)
    }
  }
  if (min === Infinity) min = 0

  return {
    categories: toGroups(count('category', (p) => p.detail.categories.map((c) => c.slug)), snap.labels.categories),
    brands: toGroups(count('brand', (p) => (p.detail.brand ? [p.detail.brand.slug] : [])), snap.labels.brands),
    lines: toGroups(count('line', (p) => (p.detail.line ? [p.detail.line.slug] : [])), snap.labels.lines),
    needs: toGroups(count('need', (p) => p.detail.needs), snap.labels.needs),
    skinTypes: toGroups(count('skin', (p) => p.detail.skinTypes.filter((s) => s !== 'all_types')), snap.labels.skinTypes),
    price: { min, max },
  }
}

export async function resolveFromSnapshot<T>(path: string): Promise<T> {
  const url = new URL(path, 'http://snapshot.local')
  const snap = await loadSnapshot()
  const p = url.pathname

  if (p === '/api/v1/categories/tree') {
    return snap.categoriesTree as T
  }
  if (p === '/api/v1/products/facets') {
    return computeFacets(url.searchParams, snap) as T
  }
  if (p === '/api/v1/products') {
    return computeList(url.searchParams, snap) as T
  }
  const productMatch = p.match(/^\/api\/v1\/products\/([a-z0-9-]+)$/)
  if (productMatch) {
    const found = snap.products.find((sp) => sp.detail.slug === productMatch[1])
    if (!found) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Товар не найден')
    return found.detail as T
  }
  throw new ApiError(404, 'NOT_FOUND', `Эндпоинт недоступен в режиме снимка: ${p}`)
}
