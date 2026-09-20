// Generates public/snapshot/catalog.json from the live local API.
// Run with the API up on :3000: node tools/generate-snapshot.mjs
const BASE = process.env.PS_API_URL || 'http://localhost:3000'

async function get(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return res.json()
}

const list = await get('/api/v1/products?limit=60&sort=newest')
const slugs = list.items.map((p) => p.slug)
if (list.total !== slugs.length) throw new Error(`expected all products in one page: ${slugs.length}/${list.total}`)

const popular = await get('/api/v1/products?limit=60&sort=popular')
const popularRank = Object.fromEntries(popular.items.map((p, i) => [p.slug, i]))
const newestRank = Object.fromEntries(slugs.map((s, i) => [s, i]))

const products = []
for (const slug of slugs) {
  const detail = await get(`/api/v1/products/${slug}`)
  products.push({
    detail,
    meta: { newestRank: newestRank[slug], popularRank: popularRank[slug] },
  })
}

const categoriesTree = await get('/api/v1/categories/tree')
const facets = await get('/api/v1/products/facets')
const labels = {}
for (const group of ['categories', 'brands', 'lines', 'needs', 'skinTypes']) {
  labels[group] = Object.fromEntries(facets[group].map((f) => [f.value, f.label]))
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  products,
  categoriesTree,
  labels,
}

const { writeFile, mkdir } = await import('node:fs/promises')
await mkdir(new URL('../public/snapshot/', import.meta.url), { recursive: true })
const out = new URL('../public/snapshot/catalog.json', import.meta.url)
await writeFile(out, JSON.stringify(snapshot))
console.log(`snapshot: ${products.length} products -> ${out.pathname}`)
