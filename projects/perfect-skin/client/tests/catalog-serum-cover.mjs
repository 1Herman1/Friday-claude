// Run against a snapshot-mode preview: PS_COVER_BASE_URL=http://127.0.0.1:5197 node tests/catalog-serum-cover.mjs
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const base = process.env.PS_COVER_BASE_URL || 'http://127.0.0.1:5197'
const output = process.env.PS_COVER_SCREENSHOTS
const asset = '/photos/catalog/syvorotki-pilot-05-native.png'
const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
const layoutFailures = []
const measurements = []
try {
  for (const width of [1440, 1024, 1023, 900, 768, 767, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${base}/catalog`, { waitUntil: 'networkidle' })
    const tile = page.locator('a[href="/catalog/syvorotki"]').filter({ has: page.getByRole('heading', { name: 'Сыворотки', exact: true }) })
    await tile.waitFor()
    assert.equal(await tile.locator(`img[src="${asset}"]`).count(), 1, `${width}: approved serum cover`)
    const image = tile.locator('img')
    await image.scrollIntoViewIfNeeded()
    await image.evaluate(img => img.decode())
    await tile.evaluate(element => element.scrollIntoView({ block: 'center' }))
    const geometry = await tile.evaluate(element => {
      const img = element.querySelector('img')
      const title = element.querySelector('h2, h3')
      const box = element.getBoundingClientRect()
      const imageBox = img.getBoundingClientRect()
      const titleBox = title.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        fit: getComputedStyle(img).objectFit,
        background: style.backgroundColor,
        overflow: style.overflow,
        radius: style.borderRadius,
        natural: [img.naturalWidth, img.naturalHeight],
        inside: imageBox.left >= box.left && imageBox.right <= box.right + 1 && imageBox.top >= box.top && imageBox.bottom <= box.bottom + 1,
        // Approved image's bottle starts to the right of its midpoint.
        titleClear: titleBox.right <= imageBox.right - Math.min(imageBox.width, imageBox.height) / 2,
        noPageOverflow: document.documentElement.scrollWidth <= innerWidth,
      }
    })
    assert.equal(geometry.fit, 'contain')
    assert.equal(geometry.background, 'rgb(255, 255, 255)')
    assert.equal(geometry.overflow, 'hidden')
    assert.notEqual(geometry.radius, '0px')
    assert.deepEqual(geometry.natural, [1254, 1254])
    assert.ok(geometry.inside && geometry.titleClear && geometry.noPageOverflow, JSON.stringify(geometry))
    assert.equal(await page.locator(`img[src="${asset}"]`).count(), 1, 'pilot is limited to one category')
    assert.deepEqual(errors, [])
    const tiles = await tile.evaluate(element => Array.from(element.parentElement.children)
      .filter(child => child.matches('a'))
      .map(child => {
        const box = child.getBoundingClientRect()
        const inner = child.firstElementChild.getBoundingClientRect()
        return { href: child.getAttribute('href'), height: box.height, width: box.width,
          innerHeight: inner.height, bottomGap: box.bottom - inner.bottom,
          radius: getComputedStyle(child).borderRadius,
          background: getComputedStyle(child).backgroundColor,
          innerBackground: getComputedStyle(child.firstElementChild).backgroundColor }
      }))
    measurements.push({ width, tiles })
    if (width < 1024) {
      const toniki = tiles.find(item => item.href === '/catalog/toniki')
      assert.ok(toniki, `${width}: toniki is covered by regression test`)
      // Snapshot categories except serum retain their original 140px fallback tiles.
      for (const item of tiles.filter(item => item.href !== '/catalog/syvorotki')) {
        if (item.height !== 140 || item.innerHeight !== 140 || Math.abs(item.bottomGap) > 0.5) {
          layoutFailures.push(`${width}: ${item.href} outer=${item.height}, inner=${item.innerHeight}, empty band=${item.bottomGap}`)
        }
        assert.equal(item.radius, '16px', `${width}: ${item.href} radius`)
        assert.equal(item.innerBackground, 'rgb(234, 230, 218)', `${width}: ${item.href} muted fill`)
      }
      assert.equal(tiles.find(item => item.href === '/catalog/syvorotki').height, 220)
    }
    if (output) {
      mkdirSync(output, { recursive: true })
      await page.screenshot({ path: `${output}/neighbors-${width}.png` })
      await tile.screenshot({ path: `${output}/serum-${width}.png` })
      await page.screenshot({ path: `${output}/catalog-${width}.png`, fullPage: true })
    }
    console.log(`PASS ${width}: exact serum asset, contain, white field, clipping, title clearance, no overflow/errors`)
    await tile.click()
    await page.waitForURL('**/catalog/syvorotki')
    await page.close()
  }
  if (output) writeFileSync(`${output}/tile-measurements.json`, JSON.stringify(measurements, null, 2))
  assert.deepEqual(layoutFailures, [], 'category tiles must not stretch into empty white bands')
  console.log('PASS all non-serum mobile/tablet tiles retain 140px outer/inner height without white bands')
  const response = await fetch(`${base}${asset}`)
  assert.equal(response.status, 200)
  const hash = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')
  assert.equal(hash, '1d96b3f46dd17ec3c4e117b824091507116080839854fb8770e8e3afe9342d6c')
  console.log('PASS served PNG is byte-identical to approved pilot')
} finally {
  await browser.close()
}
