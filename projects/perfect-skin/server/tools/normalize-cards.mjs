// Нормализация карточных фото: кластерный bbox (текст сверху отрезается),
// X-кроп, вписывание в 76% квадрата. Запуск: node normalize.mjs
import pkg from '/opt/node22/lib/node_modules/playwright/index.js'
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
const { chromium } = pkg

const SRC = '/home/user/perfect_skin/server/assets/products'
const OUT = '/home/user/perfect_skin/client/public/products-optimized'
const CHECK = process.env.CHECK_DIR

const b = await chromium.launch()
const p = await b.newPage()
await p.goto('about:blank')

async function normalize(base64, mime, target) {
  return p.evaluate(async ({ base64, mime, target }) => {
    const img = new Image()
    img.src = `data:image/${mime};base64,${base64}`
    await img.decode()
    const W = img.naturalWidth, H = img.naturalHeight
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, W, H).data
    const isContent = (x, y) => {
      const i = (y * W + x) * 4
      return d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245
    }
    // построчная масса
    const rowMass = new Array(H).fill(0)
    for (let y = 0; y < H; y++) {
      let m = 0
      for (let x = 0; x < W; x += 2) if (isContent(x, y)) m++
      rowMass[y] = m
    }
    // кластеры строк, разделённые белыми промежутками >= 3.5% H
    const gapMin = Math.max(8, Math.round(H * 0.035))
    const clusters = []
    let start = -1, lastContent = -1
    for (let y = 0; y < H; y++) {
      if (rowMass[y] > 0) {
        if (start === -1) start = y
        lastContent = y
      } else if (start !== -1 && y - lastContent >= gapMin) {
        clusters.push([start, lastContent])
        start = -1
      }
    }
    if (start !== -1) clusters.push([start, lastContent])
    if (!clusters.length) return { status: 'no-content' }
    // Держим кластеры с массой >= 20% от максимальной: текст-инфографика
    // легковесна и отпадает, а «коробка + банка» (два тяжёлых) остаются.
    const withMass = clusters.map(([a, z]) => {
      let m = 0
      for (let y = a; y <= z; y++) m += rowMass[y]
      return { a, z, m }
    })
    const maxM = Math.max(...withMass.map((c) => c.m))
    const kept = withMass.filter((c) => c.m >= maxM * 0.2)
    const y0 = Math.min(...kept.map((c) => c.a))
    const y1 = Math.max(...kept.map((c) => c.z))
    // Тот же приём по X внутри выбранных строк — боковые галочки отпадают.
    const colMass = new Array(W).fill(0)
    for (let x = 0; x < W; x++) {
      let m = 0
      for (let y = y0; y <= y1; y += 2) if (isContent(x, y)) m++
      colMass[x] = m
    }
    const gapMinX = Math.max(8, Math.round(W * 0.035))
    const xClusters = []
    let xs = -1, xLast = -1
    for (let x = 0; x < W; x++) {
      if (colMass[x] > 0) {
        if (xs === -1) xs = x
        xLast = x
      } else if (xs !== -1 && x - xLast >= gapMinX) {
        xClusters.push([xs, xLast]); xs = -1
      }
    }
    if (xs !== -1) xClusters.push([xs, xLast])
    const xWithMass = xClusters.map(([a, z]) => {
      let m = 0
      for (let x = a; x <= z; x++) m += colMass[x]
      return { a, z, m }
    })
    const maxXM = Math.max(...xWithMass.map((c) => c.m))
    const keptX = xWithMass.filter((c) => c.m >= maxXM * 0.2)
    const x0 = Math.min(...keptX.map((c) => c.a))
    const x1 = Math.max(...keptX.map((c) => c.z))
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1
    if (ch < H * 0.12 || cw < W * 0.12) return { status: 'suspicious', ch, cw }
    // вписать в 76% квадрата
    const fit = Math.round(target * 0.76)
    const scale = Math.min(fit / cw, fit / ch)
    const fw = Math.round(cw * scale), fh = Math.round(ch * scale)
    const out = document.createElement('canvas'); out.width = target; out.height = target
    const octx = out.getContext('2d')
    octx.fillStyle = '#ffffff'; octx.fillRect(0, 0, target, target)
    octx.imageSmoothingQuality = 'high'
    octx.drawImage(img, x0, y0, cw, ch, (target - fw) / 2, (target - fh) / 2, fw, fh)
    return { status: 'ok', b64: out.toDataURL('image/webp', 0.9).split(',')[1], clusters: clusters.length }
  }, { base64, mime, target })
}

const files = (await readdir(SRC)).filter((f) => /\.(jpe?g|png)$/i.test(f))
if (CHECK) await mkdir(CHECK, { recursive: true })
let ok = 0, skip = []
for (const f of files) {
  const slug = f.replace(/\.(jpe?g|png)$/i, '')
  const mime = /png$/i.test(f) ? 'png' : 'jpeg'
  const base64 = (await readFile(path.join(SRC, f))).toString('base64')
  const r1 = await normalize(base64, mime, 800)
  if (r1.status !== 'ok') { skip.push(`${slug} (${r1.status})`); continue }
  const r2 = await normalize(base64, mime, 1600)
  await mkdir(path.join(OUT, slug), { recursive: true })
  await writeFile(path.join(OUT, slug, 'card.webp'), Buffer.from(r1.b64, 'base64'))
  await writeFile(path.join(OUT, slug, 'card@2x.webp'), Buffer.from(r2.status === 'ok' ? r2.b64 : r1.b64, 'base64'))
  ok++
}
console.log('нормализовано:', ok, '| пропущено:', skip.length, skip.slice(0, 8))
await b.close()
