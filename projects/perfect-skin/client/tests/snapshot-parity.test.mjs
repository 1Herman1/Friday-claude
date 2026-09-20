// Тесты клиентского движка снимка каталога (src/lib/snapshot.ts).
//
// Часть 1 (offline) — краевые случаи против public/snapshot/catalog.json.
// Часть 2 (parity) — сверка с живым API на localhost:3000; мягко скипается,
// если API не отвечает (CI без базы).
//
// Запуск: node --test perfect-skin/client/tests/snapshot-parity.test.mjs
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const clientRoot = path.resolve(here, '..')
const snapshotJsonPath = path.join(clientRoot, 'public/snapshot/catalog.json')
const API_BASE = process.env.PS_API_BASE || 'http://localhost:3000'

let resolveFromSnapshot
let snapshotRaw
let snapshotData
const realFetch = globalThis.fetch
let apiAvailable = false

before(async () => {
  snapshotRaw = await readFile(snapshotJsonPath, 'utf-8')
  snapshotData = JSON.parse(snapshotRaw)

  const outdir = await mkdtemp(path.join(tmpdir(), 'ps-snapshot-'))
  const outfile = path.join(outdir, 'snapshot.bundle.mjs')
  await build({
    entryPoints: [path.join(clientRoot, 'src/lib/snapshot.ts')],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    outfile,
    define: {
      'import.meta.env.BASE_URL': '"/"',
      'import.meta.env.VITE_API_URL': 'undefined',
      'import.meta.env.VITE_API_MODE': '"snapshot"',
    },
    alias: { '@': path.join(clientRoot, 'src') },
  })
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('/snapshot/catalog.json')) {
      return new Response(snapshotRaw, { status: 200 })
    }
    return realFetch(url, opts)
  }

  ;({ resolveFromSnapshot } = await import(outfile))

  try {
    const res = await realFetch(`${API_BASE}/api/v1/products?limit=1`, {
      signal: AbortSignal.timeout(2000),
    })
    apiAvailable = res.ok
  } catch {
    apiAvailable = false
  }
})

const canon = (v) =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canon(v[k])])
        )
      : v

async function expectApiError(path, status, code) {
  const err = await resolveFromSnapshot(path).then(
    () => null,
    (e) => e
  )
  assert.ok(err, `ожидалась ошибка для ${path}`)
  assert.equal(err.status, status)
  assert.equal(err.code, code)
}

describe('snapshot: краевые случаи (offline)', () => {
  test('limit клампится в 1..60: 0 → дефолт 24', async () => {
    const r = await resolveFromSnapshot('/api/v1/products?limit=0')
    assert.equal(r.limit, 24)
    assert.equal(r.items.length, Math.min(24, r.total))
  })

  test('limit отрицательный клампится к 1', async () => {
    const r = await resolveFromSnapshot('/api/v1/products?limit=-5')
    assert.equal(r.limit, 1)
    assert.equal(r.items.length, 1)
  })

  test('limit=999 клампится к 60', async () => {
    const r = await resolveFromSnapshot('/api/v1/products?limit=999')
    assert.equal(r.limit, 60)
    assert.equal(r.total, snapshotData.products.length)
    assert.equal(r.items.length, Math.min(60, r.total))
  })

  test('limit мусорный → дефолт 24', async () => {
    const r = await resolveFromSnapshot('/api/v1/products?limit=abc')
    assert.equal(r.limit, 24)
  })

  test('offset за пределами total → пустой items, total корректный', async () => {
    const r = await resolveFromSnapshot('/api/v1/products?offset=1000&limit=24')
    assert.deepEqual(r.items, [])
    assert.equal(r.total, snapshotData.products.length)
    assert.equal(r.offset, 1000)
    assert.equal(r.limit, 24)
  })

  test('offset отрицательный клампится к 0', async () => {
    const r = await resolveFromSnapshot('/api/v1/products?offset=-10&limit=3')
    assert.equal(r.offset, 0)
    const base = await resolveFromSnapshot('/api/v1/products?limit=3')
    assert.deepEqual(r.items, base.items)
  })

  test('мусорный minPrice игнорируется (не режет выдачу)', async () => {
    const dirty = await resolveFromSnapshot('/api/v1/products?minPrice=abc&limit=60')
    const clean = await resolveFromSnapshot('/api/v1/products?limit=60')
    assert.equal(dirty.total, clean.total)
    assert.equal(dirty.total, snapshotData.products.length)
  })

  test('пустой minPrice/maxPrice игнорируется', async () => {
    const r = await resolveFromSnapshot('/api/v1/products?minPrice=&maxPrice=&limit=60')
    assert.equal(r.total, snapshotData.products.length)
  })

  test('неизвестная категория → фильтр отброшен, выдача полная', async () => {
    const r = await resolveFromSnapshot('/api/v1/products?category=nesushhestvuyushhaya&limit=60')
    assert.equal(r.total, snapshotData.products.length)
  })

  test('неизвестный бренд → фильтр отброшен', async () => {
    const r = await resolveFromSnapshot('/api/v1/products?brand=nesushhestvuyushhij&limit=60')
    assert.equal(r.total, snapshotData.products.length)
  })

  test('известный + неизвестный бренд → фильтрует по известному', async () => {
    const known = Object.keys(snapshotData.labels.brands)[0]
    const mixed = await resolveFromSnapshot(
      `/api/v1/products?brand=${known}&brand=nesushhestvuyushhij&limit=60`
    )
    const only = await resolveFromSnapshot(`/api/v1/products?brand=${known}&limit=60`)
    assert.equal(mixed.total, only.total)
    assert.ok(mixed.total > 0)
  })

  test('неизвестный slug товара → ApiError 404 PRODUCT_NOT_FOUND', async () => {
    await expectApiError('/api/v1/products/nesushhestvuyushhij-tovar', 404, 'PRODUCT_NOT_FOUND')
  })

  test('не-каталожный путь → ApiError 404 NOT_FOUND', async () => {
    await expectApiError('/api/v1/cart', 404, 'NOT_FOUND')
  })

  test('фасеты: skinTypes не содержат all_types', async () => {
    const f = await resolveFromSnapshot('/api/v1/products/facets')
    assert.ok(f.skinTypes.length > 0)
    assert.ok(!f.skinTypes.some((g) => g.value === 'all_types'))
  })

  test('фасеты: сортировка count desc, затем label по алфавиту', async () => {
    const f = await resolveFromSnapshot('/api/v1/products/facets')
    for (const group of [f.categories, f.brands, f.lines, f.needs, f.skinTypes]) {
      for (let i = 1; i < group.length; i++) {
        const prev = group[i - 1]
        const cur = group[i]
        const ok = prev.count > cur.count || (prev.count === cur.count && prev.label.localeCompare(cur.label) <= 0)
        assert.ok(ok, `нарушен порядок: ${JSON.stringify(prev)} перед ${JSON.stringify(cur)}`)
      }
    }
  })

  test('фасеты: своя группа не сужается собственным фильтром', async () => {
    const all = await resolveFromSnapshot('/api/v1/products/facets')
    const brand = all.brands[0].value
    const filtered = await resolveFromSnapshot(`/api/v1/products/facets?brand=${brand}`)
    assert.deepEqual(
      filtered.brands.map((g) => g.value).sort(),
      all.brands.map((g) => g.value).sort()
    )
  })

  test('price_asc/price_desc: цена монотонна, tie-break по id', async () => {
    const asc = await resolveFromSnapshot('/api/v1/products?sort=price_asc&limit=60')
    for (let i = 1; i < asc.items.length; i++) {
      const a = asc.items[i - 1]
      const b = asc.items[i]
      assert.ok(a.minPrice < b.minPrice || (a.minPrice === b.minPrice && a.id.localeCompare(b.id) <= 0))
    }
    const desc = await resolveFromSnapshot('/api/v1/products?sort=price_desc&limit=60')
    for (let i = 1; i < desc.items.length; i++) {
      const a = desc.items[i - 1]
      const b = desc.items[i]
      assert.ok(a.minPrice > b.minPrice || (a.minPrice === b.minPrice && a.id.localeCompare(b.id) <= 0))
    }
  })

  test('фильтр skin включает товары с all_types', async () => {
    const r = await resolveFromSnapshot('/api/v1/products?skin=dry&limit=60')
    assert.ok(r.total > 0)
    for (const it of r.items) {
      assert.ok(it.skinTypes.includes('dry') || it.skinTypes.includes('all_types'))
    }
  })

  test('пагинация не теряет и не дублирует товары', async () => {
    const seen = []
    for (let offset = 0; offset < snapshotData.products.length; offset += 10) {
      const page = await resolveFromSnapshot(`/api/v1/products?sort=price_asc&limit=10&offset=${offset}`)
      seen.push(...page.items.map((i) => i.id))
    }
    assert.equal(seen.length, snapshotData.products.length)
    assert.equal(new Set(seen).size, snapshotData.products.length)
  })

  test('карточка списка не тащит поля детальной страницы', async () => {
    const r = await resolveFromSnapshot('/api/v1/products?limit=1')
    assert.deepEqual(Object.keys(r.items[0]).sort(), [
      'brand',
      'id',
      'image',
      'inStock',
      'line',
      'minPrice',
      'name',
      'needs',
      'oldPrice',
      'skinTypes',
      'slug',
      'variants',
    ])
  })
})

const PARITY_CASES = [
  '/api/v1/products?limit=60',
  '/api/v1/products?q=%D0%BA%D1%80%D0%B5%D0%BC&limit=60',
  '/api/v1/products?q=ISSEIMI&limit=60',
  '/api/v1/products?q=%D1%80%D0%B5%D1%82%D0%B8&limit=60',
  '/api/v1/products?q=zzz-net&limit=60',
  '/api/v1/products?sort=popular&limit=60',
  '/api/v1/products?sort=price_asc&limit=60',
  '/api/v1/products?sort=price_desc&limit=60',
  '/api/v1/products?category=syvorotki&limit=60',
  '/api/v1/products?brand=isseimi&skin=dry&limit=60',
  '/api/v1/products?need=hydration&minPrice=300000&maxPrice=800000&limit=60',
  '/api/v1/products?line=isseimi-md&limit=60',
  '/api/v1/products?limit=6&offset=6&sort=price_asc',
  '/api/v1/products?brand=nesushhestvuyushhij&limit=60',
  // limit>60 сервер отклоняет валидацией (zod max 60), поэтому в паритет не входит
  '/api/v1/products?offset=1000&limit=24',
  '/api/v1/products/facets',
  '/api/v1/products/facets?category=kremy-dlya-litsa-i-shei',
  '/api/v1/products/facets?brand=glacee-skincare&skin=oily',
  '/api/v1/products/facets?minPrice=500000',
  '/api/v1/products/facets?need=hydration&need=firming',
  '/api/v1/categories/tree',
  '/api/v1/products/gen-adn-ukreplyayushhij-krem',
]

describe('snapshot: паритет с живым API', () => {
  for (const c of PARITY_CASES) {
    test(c, async (t) => {
      if (!apiAvailable) {
        t.skip(`API ${API_BASE} недоступен`)
        return
      }
      const [snap, live] = await Promise.all([
        resolveFromSnapshot(c),
        realFetch(API_BASE + c).then((r) => r.json()),
      ])
      assert.deepEqual(canon(snap), canon(live))
    })
  }
})
