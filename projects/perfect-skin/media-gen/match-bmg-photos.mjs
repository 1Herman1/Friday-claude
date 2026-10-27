#!/usr/bin/env node
// Сопоставление товаров Perfect Skin с каталогом beautymedgroup.ru и отчёт о фото.
// Запуск: node projects/perfect-skin/media-gen/match-bmg-photos.mjs
// Флаги (для тестов): --catalog <catalog.json> --out-md <file> --out-json <file>
import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const PS = path.resolve(here, '..')
const ROOT = path.resolve(PS, '../..')
const BMG_DIR = path.join(ROOT, 'docs/projects/perfect-skin/media/bmg-products')

const argv = process.argv.slice(2)
const flag = (name, def) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? path.resolve(argv[i + 1]) : def
}
const CATALOG = flag('--catalog', path.join(BMG_DIR, 'catalog.json'))
const OUT_JSON = flag('--out-json', path.join(BMG_DIR, 'matches.json'))
const OUT_MD = flag('--out-md', path.join(ROOT, 'docs/projects/perfect-skin/content/product-photos-2026-10-27.md'))
const IMAGES_ROOT = path.dirname(CATALOG)

const ASSETS = path.join(PS, 'server/assets')
const PUBLIC = path.join(PS, 'client/public')

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'))
const exists = async (p) => {
  try {
    return (await stat(p)).isFile()
  } catch {
    return false
  }
}
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/')

// ---------- нормализация названий ----------
const STOP = new Set([
  'isseimi', 'glacee', 'glac', 'skincare', 'skin', 'care', 'base', 'line', 'man', 'pro', 'professional',
  'ml', 'мл', 'г', 'гр', 'шт', 'for', 'the', 'and', 'de', 'la', 'el', 'con', 'para',
  'для', 'и', 'с', 'со', 'от', 'на', 'по', 'в', 'из', 'к', 'или', 'а', 'не', 'без', 'при', 'за', 'о',
  'набор', 'подарочный', 'линия', 'уход', 'средство',
])

function baseNorm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/×/g, 'x')
}

function tokenize(name) {
  const text = baseNorm(name).replace(/[«»"'`’()[\]{}.,;:!?/\\|+\-–—_%№*]/g, ' ')
  const raw = text.split(/\s+/).filter(Boolean)
  const volumeFree = []
  for (let i = 0; i < raw.length; i++) {
    if (/^\d+$/.test(raw[i]) && /^(мл|ml|г|гр|шт|pcs)$/.test(raw[i + 1] || '')) {
      i++
      continue
    }
    if (/^\d+(мл|ml|г|гр|шт)$/.test(raw[i])) continue
    volumeFree.push(raw[i])
  }
  const latin = []
  const cyr = []
  for (const t of volumeFree) {
    if (STOP.has(t)) continue
    if (/[a-z]/.test(t)) latin.push(t)
    else if (/[а-я]/.test(t)) cyr.push(t.slice(0, 5))
    else if (/^\d+$/.test(t) && t.length < 4) latin.push(t)
  }
  // склейка соседей: «AQUA O3» == «AQUAO3», «EGF HIDROSOLUBLE» тоже даёт токен-слитку
  const merged = new Set(latin)
  for (let i = 0; i < latin.length - 1; i++) merged.add(latin[i] + latin[i + 1])
  return { latin: [...merged], cyr: [...new Set(cyr)], latinBase: latin }
}

function dice(a, b) {
  if (!a.length || !b.length) return null
  const B = new Set(b)
  const inter = a.filter((t) => B.has(t)).length
  const containment = inter / Math.min(a.length, b.length)
  return Math.max((2 * inter) / (a.length + b.length), 0.85 * containment)
}

function latinCoverage(from, to) {
  const compact = to.latinBase.join('')
  let hit = 0
  for (const t of from.latinBase) if (to.latin.includes(t) || (t.length >= 2 && compact.includes(t))) hit++
  return hit
}

// Латиница (бренд/линейка/вариант) — главный сигнал: «AQUA O3 GF» и «AQUA O3 WHITENING» — разные товары,
// поэтому непарные латинские токены с обеих сторон роняют оценку.
function nameScore(a, b) {
  const ta = tokenize(a)
  const tb = tokenize(b)
  const C = dice(ta.cyr, tb.cyr)
  const nA = ta.latinBase.length
  const nB = tb.latinBase.length
  if (nA && nB) {
    const hitA = latinCoverage(ta, tb)
    const hitB = latinCoverage(tb, ta)
    const L = (hitA + hitB) / (nA + nB)
    let score = C !== null ? 0.7 * L + 0.3 * C : 0.85 * L
    if (hitA < nA && hitB < nB) score *= 0.6
    return score
  }
  if (C !== null) return 0.85 * C
  return 0
}

function volumeOf(text, fallback) {
  if (fallback) return Number(fallback)
  const m = baseNorm(text).match(/(\d+(?:[.,]\d+)?)\s*(мл|ml)\b/)
  return m ? Number(m[1].replace(',', '.')) : null
}

// ---------- наши товары ----------
async function loadOurs() {
  const curated = (await readJson(path.join(ASSETS, 'catalog-curated.json'))).products
  const retail = (await readJson(path.join(ASSETS, 'retail-products.json'))).products
  const pro = (await readJson(path.join(ASSETS, 'pro-products.json'))).products
  const list = []
  const seen = new Set()
  const add = (p) => {
    if (seen.has(p.slug)) return
    seen.add(p.slug)
    list.push(p)
  }
  for (const p of curated) add({ source: 'catalog-curated', slug: p.slug, name: p.name, brand: p.brand, article: null, volume: volumeOf(p.name, p.volume), imageFile: p.imageFile || null, images: p.images || [], imageUrl: null })
  for (const p of retail) add({ source: 'retail-products', slug: p.slug, name: p.name, brand: p.brand, article: p.article, volume: volumeOf(p.name, p.volume), imageFile: p.imageFile || null, images: p.images || [], imageUrl: p.imageUrl || null })
  for (const p of pro) add({ source: 'pro-products', slug: p.slug, name: p.name, brand: p.brand, article: p.article, volume: volumeOf(p.name, p.volume?.unit === 'ml' ? p.volume.value : null), imageFile: p.imageFile || null, images: p.images || [], imageUrl: null })
  return list
}

async function ourPhotoState(p, optimizedDirs) {
  const found = []
  if (p.images.length) found.push(`images[${p.images.length}]`)
  if (p.imageFile) {
    if (await exists(path.join(PUBLIC, 'products', p.imageFile))) found.push('public/products')
    if (await exists(path.join(ASSETS, 'products', p.imageFile))) found.push('assets/products')
  }
  const candidates = new Set([p.slug, p.imageFile ? path.parse(p.imageFile).name : null].filter(Boolean))
  for (const d of optimizedDirs) if (p.slug.startsWith(d)) candidates.add(d)
  for (const d of candidates) {
    if (optimizedDirs.has(d) && (await exists(path.join(PUBLIC, 'products-optimized', d, 'card.webp')))) {
      found.push('products-optimized/card.webp')
      break
    }
  }
  return found
}

// ---------- BMG ----------
function bmgPhotos(bmg) {
  return (bmg.images || []).map((im, i) => ({ src: im.src, file: im.file ? rel(path.join(IMAGES_ROOT, im.file)) : null, n: i + 1 }))
}

async function bmgPhotoFiles(bmg) {
  const fromCatalog = (bmg.images || []).filter((im) => im.file)
  if (fromCatalog.length) return fromCatalog.map((im) => rel(path.join(IMAGES_ROOT, im.file)))
  return []
}

const baseNameOfUrl = (u) => (u ? decodeURIComponent(u.split('?')[0].split('/').pop() || '').toLowerCase().replace(/-\d+x\d+(?=\.)/, '') : '')

function matchOne(p, bmgProducts) {
  const scored = bmgProducts.map((b) => {
    let score = nameScore(p.name, b.name)
    const reasons = []
    const bv = volumeOf(b.name, null)
    if (p.volume && bv) score += p.volume === bv ? 0.05 : -0.1
    let strong = false
    if (p.article && b.sku && String(p.article).trim() === String(b.sku).trim()) {
      if (score >= 0.3) strong = true
      score = Math.max(score, 0.5)
      reasons.push('sku')
    }
    if (p.imageUrl && (b.images || []).some((im) => baseNameOfUrl(im.src) === baseNameOfUrl(p.imageUrl))) {
      strong = true
      score = Math.max(score, 0.95)
      reasons.push('image')
    }
    return { b, score: Math.min(score, 1), strong, reasons }
  })
  scored.sort((x, y) => y.score - x.score)
  const best = scored[0]
  const second = scored[1]
  let confidence = 'нет'
  if (best && (best.strong || best.score >= 0.8)) confidence = 'точно'
  else if (best && best.score >= 0.5) confidence = 'вероятно'
  if (confidence === 'точно' && !best.strong && second && best.score - second.score < 0.05) confidence = 'вероятно'
  return { best: confidence === 'нет' ? null : best, confidence, candidates: scored.slice(0, 3).filter((c) => c.score >= 0.3) }
}

// ---------- main ----------
const cat = await readJson(CATALOG)
const bmgProducts = Array.isArray(cat) ? cat : cat.products
if (!bmgProducts?.length) throw new Error(`Каталог BMG пуст: ${CATALOG}`)

const optimizedDirs = new Set(await readdir(path.join(PUBLIC, 'products-optimized')).catch(() => []))
const ours = await loadOurs()
const rows = []
for (const p of ours) {
  const have = await ourPhotoState(p, optimizedDirs)
  const m = matchOne(p, bmgProducts)
  const files = m.best ? await bmgPhotoFiles(m.best.b) : []
  rows.push({
    slug: p.slug,
    source: p.source,
    name: p.name,
    article: p.article,
    ourPhoto: have.length > 0,
    ourPhotoWhere: have,
    bmg: m.best ? { id: m.best.b.id, name: m.best.b.name, slug: m.best.b.slug, permalink: m.best.b.permalink, sku: m.best.b.sku, photosTotal: (m.best.b.images || []).length } : null,
    bmgPhotos: files,
    score: m.best ? Number(m.best.score.toFixed(2)) : null,
    confidence: m.confidence,
    reasons: m.best ? m.best.reasons : [],
    candidates: m.candidates.map((c) => ({ name: c.b.name, permalink: c.b.permalink, score: Number(c.score.toFixed(2)) })),
  })
}

await mkdir(path.dirname(OUT_JSON), { recursive: true })
await writeFile(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), bmgProducts: bmgProducts.length, ours: rows.length, matches: rows }, null, 2) + '\n')

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const cut = (s, n = 70) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const hasBmgPhoto = (r) => r.bmg && r.confidence !== 'нет' && (r.bmg.photosTotal > 0)
const noPhotoAnywhere = rows.filter((r) => !r.ourPhoto && !hasBmgPhoto(r))
const usable = rows.filter((r) => !r.ourPhoto && hasBmgPhoto(r))
const count = (f) => rows.filter(f).length

const md = []
md.push('# Фото товаров Perfect Skin: наши и beautymedgroup.ru')
md.push('')
md.push('Сгенерировано `projects/perfect-skin/media-gen/match-bmg-photos.mjs` (2026-10-27). Не править руками: перезапуск скрипта перезапишет файл.')
md.push('')
md.push(`- Наших товаров: ${rows.length} (catalog-curated ${count((r) => r.source === 'catalog-curated')}, retail-products ${count((r) => r.source === 'retail-products')}, pro-products ${count((r) => r.source === 'pro-products')})`)
md.push(`- Товаров в выгрузке BMG: ${bmgProducts.length}`)
md.push(`- Фото у нас есть: ${count((r) => r.ourPhoto)}; нет: ${count((r) => !r.ourPhoto)}`)
md.push(`- Сопоставлено с BMG: точно ${count((r) => r.confidence === 'точно')}, вероятно ${count((r) => r.confidence === 'вероятно')}, не найдено ${count((r) => r.confidence === 'нет')}`)
md.push(`- Нет у нас, но есть фото на BMG: ${usable.length}`)
md.push(`- Нет фото нигде: ${noPhotoAnywhere.length}`)
md.push('')
md.push('Уверенность: «точно» — совпал артикул/файл картинки или название на 80%+ и однозначно; «вероятно» — 50-80% или рядом есть почти равный кандидат (проверить глазами); «нет» — похожего товара нет.')
md.push('')
md.push('## Все товары')
md.push('')
md.push('| # | Источник | Slug | Название | Фото у нас | Товар BMG | Фото BMG (скачано) | Уверенность |')
md.push('|---|---|---|---|---|---|---|---|')
rows.forEach((r, i) => {
  const bmg = r.bmg ? `[${esc(cut(r.bmg.name, 60))}](${r.bmg.permalink})` : '—'
  const photos = r.bmgPhotos.length ? r.bmgPhotos.map((f) => `\`${f.replace('docs/projects/perfect-skin/media/bmg-products/', '')}\``).join('<br>') : r.bmg ? (r.bmg.photosTotal ? `${r.bmg.photosTotal} шт., не скачано` : 'у BMG нет фото') : '—'
  const conf = r.confidence === 'нет' ? 'нет' : `${r.confidence} (${r.score}${r.reasons.length ? ', ' + r.reasons.join('+') : ''})`
  md.push(`| ${i + 1} | ${r.source} | \`${cut(r.slug, 48)}\` | ${esc(cut(r.name))} | ${r.ourPhoto ? 'да: ' + r.ourPhotoWhere.join(', ') : '**нет**'} | ${bmg} | ${photos} | ${conf} |`)
})
md.push('')
md.push('## Нет у нас, но найдено на BMG — кандидаты на подключение')
md.push('')
if (usable.length) {
  md.push('| Slug | Название | Товар BMG | Уверенность |')
  md.push('|---|---|---|---|')
  for (const r of usable) md.push(`| \`${cut(r.slug, 48)}\` | ${esc(cut(r.name))} | [${esc(cut(r.bmg.name, 60))}](${r.bmg.permalink}) | ${r.confidence} (${r.score}) |`)
} else md.push('Таких нет.')
md.push('')
md.push('## Нет фото ни у нас, ни на BMG — запросить у клиента')
md.push('')
if (noPhotoAnywhere.length) {
  md.push('| Slug | Название | Лучшие кандидаты BMG (если есть) |')
  md.push('|---|---|---|')
  for (const r of noPhotoAnywhere) {
    const cand = r.candidates.length ? r.candidates.map((c) => `[${esc(cut(c.name, 45))}](${c.permalink}) ${c.score}`).join('<br>') : '—'
    md.push(`| \`${cut(r.slug, 48)}\` | ${esc(cut(r.name, 90))} | ${cand} |`)
  }
} else md.push('Таких нет.')
md.push('')

await mkdir(path.dirname(OUT_MD), { recursive: true })
await writeFile(OUT_MD, md.join('\n'))

console.log(`Наших товаров: ${rows.length}; BMG: ${bmgProducts.length}`)
console.log(`Сопоставлено: точно ${count((r) => r.confidence === 'точно')}, вероятно ${count((r) => r.confidence === 'вероятно')}, нет ${count((r) => r.confidence === 'нет')}`)
console.log(`Без фото у нас: ${count((r) => !r.ourPhoto)}; найдено на BMG: ${usable.length}; нет нигде: ${noPhotoAnywhere.length}`)
console.log(`Отчёт: ${rel(OUT_MD)}`)
console.log(`JSON: ${rel(OUT_JSON)}`)
