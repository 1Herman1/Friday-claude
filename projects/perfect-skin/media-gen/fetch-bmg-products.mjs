#!/usr/bin/env node
// Выгрузка публичного каталога beautymedgroup.ru (WooCommerce) и всех фото товаров.
// Запуск на раннере GitHub Actions: node projects/perfect-skin/media-gen/fetch-bmg-products.mjs
// Порядок источников: Store API -> wp/v2/product -> sitemap + страницы товаров.
// Только публичные данные, без авторизации.
import { mkdir, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '../../..')
const BASE = (process.env.BMG_BASE || 'https://beautymedgroup.ru').replace(/\/$/, '')
const OUT = process.env.BMG_OUT || path.join(ROOT, 'docs/projects/perfect-skin/media/bmg-products')
const IMAGES = path.join(OUT, 'images')
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const MAX_PAGES = 60

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pause = () => sleep(300 + Math.random() * 200)

function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

// 4xx (кроме 429) не повторяем: закрытый эндпоинт надо быстро распознать и идти в фолбэк.
async function request(url, { binary = false, accept } = {}) {
  let lastErr
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'ru-RU,ru;q=0.9', ...(accept ? { Accept: accept } : {}) },
        redirect: 'follow',
        signal: AbortSignal.timeout(45000),
      })
      if (res.ok) {
        const type = res.headers.get('content-type') || ''
        if (binary) return { buf: Buffer.from(await res.arrayBuffer()), type, status: res.status }
        return { text: await res.text(), type, status: res.status }
      }
      lastErr = new Error(`HTTP ${res.status}`)
      lastErr.status = res.status
      if (res.status >= 400 && res.status < 500 && res.status !== 429) break
    } catch (e) {
      lastErr = e
    }
    await sleep(1000 * 2 ** (attempt - 1))
  }
  console.log(`  ! ${url}: ${lastErr?.message}`)
  return { error: lastErr, status: lastErr?.status ?? 0 }
}

async function getJson(url) {
  const r = await request(url, { accept: 'application/json' })
  if (r.error) return { status: r.status }
  try {
    return { data: JSON.parse(r.text), status: r.status }
  } catch {
    console.log(`  ! ${url}: ответ не JSON`)
    return { status: r.status }
  }
}

function pickImages(list) {
  const seen = new Set()
  const out = []
  for (const im of list) {
    const src = im?.src
    if (!src || seen.has(src)) continue
    seen.add(src)
    out.push({ src, alt: decodeEntities(im.alt || im.name || '') })
  }
  return out
}

async function viaStoreApi() {
  console.log('Источник 1: WooCommerce Store API')
  const products = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, status } = await getJson(`${BASE}/wp-json/wc/store/v1/products?per_page=100&page=${page}`)
    if (!Array.isArray(data)) {
      console.log(`  страница ${page}: нет данных (status ${status})`)
      break
    }
    console.log(`  страница ${page}: ${data.length} товаров`)
    if (!data.length) break
    for (const p of data) {
      products.push({
        id: p.id,
        name: decodeEntities(p.name),
        slug: p.slug,
        permalink: p.permalink,
        sku: p.sku || '',
        categories: (p.categories || []).map((c) => decodeEntities(c.name)),
        images: pickImages(p.images || []),
      })
    }
    if (data.length < 100) break
    await pause()
  }
  return products
}

async function viaWpV2() {
  console.log('Источник 2: wp/v2/product')
  const products = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, status } = await getJson(`${BASE}/wp-json/wp/v2/product?per_page=100&page=${page}&_embed`)
    if (!Array.isArray(data)) {
      console.log(`  страница ${page}: нет данных (status ${status})`)
      break
    }
    console.log(`  страница ${page}: ${data.length} товаров`)
    if (!data.length) break
    for (const p of data) {
      const media = p._embedded?.['wp:featuredmedia']?.[0]
      const terms = (p._embedded?.['wp:term'] || []).flat().filter((t) => t?.taxonomy === 'product_cat')
      products.push({
        id: p.id,
        name: decodeEntities(p.title?.rendered),
        slug: p.slug,
        permalink: p.link,
        sku: p.sku || p.meta?._sku || '',
        categories: terms.map((t) => decodeEntities(t.name)),
        images: pickImages(media?.source_url ? [{ src: media.source_url, alt: media.alt_text }] : []),
      })
    }
    if (data.length < 100) break
    await pause()
  }
  return products
}

function locs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => decodeEntities(m[1]))
}

async function productUrlsFromSitemap() {
  const candidates = [`${BASE}/product-sitemap.xml`, `${BASE}/wp-sitemap-posts-product-1.xml`]
  const index = await request(`${BASE}/sitemap_index.xml`)
  if (!index.error) {
    for (const u of locs(index.text)) if (/product/i.test(u) && !candidates.includes(u)) candidates.push(u)
  }
  const urls = new Set()
  for (const c of candidates) {
    const r = await request(c)
    await pause()
    if (r.error) continue
    const found = locs(r.text).filter((u) => !/\.(jpe?g|png|webp|gif)(\?|$)/i.test(u))
    console.log(`  ${c}: ${found.length} ссылок`)
    found.forEach((u) => urls.add(u))
  }
  return [...urls]
}

function metaContent(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i')
  return decodeEntities((html.match(re) || html.match(re2) || [])[1] || '')
}

async function viaSitemap() {
  console.log('Источник 3: sitemap + страницы товаров')
  const urls = await productUrlsFromSitemap()
  const products = []
  for (const url of urls) {
    const r = await request(url)
    await pause()
    if (r.error) continue
    const html = r.text
    const gallery = [...html.matchAll(/data-large_image=["']([^"']+)["']/g)].map((m) => ({ src: decodeEntities(m[1]) }))
    const og = metaContent(html, 'og:image')
    const imgs = pickImages([...(og ? [{ src: og }] : []), ...gallery])
    const h1 = (html.match(/<h1[^>]*product_title[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]
    const name = decodeEntities((h1 || metaContent(html, 'og:title') || '').replace(/<[^>]+>/g, ''))
    if (!name) continue
    const id = Number((html.match(/[?&]p=(\d+)/) || html.match(/\bpostid-(\d+)/) || [])[1]) || null
    const sku = decodeEntities(((html.match(/class=["']sku["'][^>]*>([^<]*)</i) || [])[1]) || '')
    const cats = [...(html.match(/class=["']posted_in["'][\s\S]*?<\/span>/i) || [''])[0].matchAll(/rel=["']tag["'][^>]*>([^<]+)</g)].map((m) => decodeEntities(m[1]))
    const slug = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '')
    products.push({ id, name, slug, permalink: url, sku: sku === 'N/A' ? '' : sku, categories: cats, images: imgs })
  }
  return products
}

function extFor(src, type) {
  const fromUrl = path.extname(new URL(src).pathname).toLowerCase().replace('.', '')
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(fromUrl)) return fromUrl === 'jpeg' ? 'jpg' : fromUrl
  if (/png/.test(type)) return 'png'
  if (/webp/.test(type)) return 'webp'
  if (/gif/.test(type)) return 'gif'
  if (/avif/.test(type)) return 'avif'
  return 'jpg'
}

async function exists(p) {
  try {
    return (await stat(p)).size > 0
  } catch {
    return false
  }
}

async function downloadImages(products) {
  let ok = 0
  let failed = 0
  let total = 0
  for (const p of products) {
    const dirName = (p.slug || `id-${p.id}`).replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 100) || `id-${p.id}`
    p.dir = path.posix.join('images', dirName)
    for (const [i, im] of p.images.entries()) {
      total++
      const dir = path.join(OUT, 'images', dirName)
      await mkdir(dir, { recursive: true })
      const guess = extFor(im.src, '')
      const prior = ['jpg', 'png', 'webp', 'gif', 'avif'].map((e) => `${i + 1}.${e}`)
      let found = null
      for (const f of prior) if (await exists(path.join(dir, f))) found = f
      if (found) {
        im.file = path.posix.join('images', dirName, found)
        ok++
        continue
      }
      const r = await request(im.src, { binary: true, accept: 'image/*' })
      await pause()
      if (r.error || !/^image\//.test(r.type) || r.buf.length < 200) {
        failed++
        if (!r.error) console.log(`  ! ${im.src}: не изображение (${r.type}, ${r.buf.length} байт)`)
        continue
      }
      const file = `${i + 1}.${extFor(im.src, r.type) || guess}`
      await writeFile(path.join(dir, file), r.buf)
      im.file = path.posix.join('images', dirName, file)
      ok++
    }
  }
  return { ok, failed, total }
}

async function main() {
  console.log(`BMG: ${BASE}`)
  let method = 'wc-store-api'
  let products = await viaStoreApi()
  if (!products.length) {
    method = 'wp-v2-product'
    products = await viaWpV2()
  }
  if (!products.length) {
    method = 'sitemap'
    products = await viaSitemap()
  }
  if (!products.length) {
    console.error('::error::ни один источник не вернул товаров')
    process.exit(1)
  }
  console.log(`Товаров: ${products.length} (источник: ${method})`)

  await mkdir(OUT, { recursive: true })
  const stats = await downloadImages(products)
  console.log(`Картинок: ${stats.total}, скачано/есть: ${stats.ok}, ошибок: ${stats.failed}`)

  const catalog = {
    meta: { base: BASE, method, fetchedAt: new Date().toISOString(), products: products.length, images: stats.total, imagesOk: stats.ok, imagesFailed: stats.failed },
    products: products.map(({ id, name, slug, permalink, sku, categories, images, dir }) => ({ id, name, slug, permalink, sku, categories, dir, images })),
  }
  await writeFile(path.join(OUT, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n')
  console.log(`Записан ${path.relative(ROOT, path.join(OUT, 'catalog.json'))}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
