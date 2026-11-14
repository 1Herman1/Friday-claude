// Read-only local snapshot regression: kit radii and catalogue-only desktop hover.
import assert from 'node:assert/strict'
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core')
const base = new URL(process.env.PS_E2E_BASE_URL || 'http://127.0.0.1:5193')
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))
const engine = process.env.ENGINE || 'chromium'
const browser = await ({ chromium, webkit }[engine]).launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
const errors = []
await context.route('**/*', route => {
  const request = route.request(), url = new URL(request.url())
  return url.origin !== base.origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method()) ? route.abort() : route.continue()
})
const page = await context.newPage()
page.on('pageerror', error => errors.push(error.message))
const check = process.env.TEST_CASE || 'all'
try {
  if (check === 'all' || check === 'radii') {
    await page.goto(base.origin + '/catalog')
    await page.locator('.catalog-editorial').waitFor()
    for (const width of [1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      const tiles = page.locator('.catalog-tile')
      assert((await tiles.evaluateAll(es => es.every(e => getComputedStyle(e).borderRadius === '16px'))), 'Block kit radius must be 16px')
      assert((await page.locator('.catalog-packshot').evaluateAll(es => es.every(e => getComputedStyle(e).borderRadius === '12px'))), 'Media kit radius must be 12px')
      const box = await page.locator('.catalog-all').boundingBox()
      const gridWidth = await page.locator('.catalog-editorial').evaluate(e => e.getBoundingClientRect().width)
      assert(Math.abs(box.width - box.height) < 2, 'Square geometry retained')
      assert(Math.abs(box.width - (gridWidth - 36) / 4) < 2, 'Grid span retained')
    }
  }
  if (check === 'all' || check === 'hover') {
    await page.goto(base.origin + '/catalog/all')
    const card = page.locator('main div.hover\\:-translate-y-1').filter({ has: page.locator('a[href^="/product/"]') }).first()
    await card.waitFor()
    for (const width of [1280, 1440, 1920, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await card.scrollIntoViewIfNeeded()
      await page.mouse.move(0, 0)
      await page.waitForTimeout(300)
      const before = await card.boundingBox()
      await card.hover()
      await page.waitForTimeout(300)
      const after = await card.boundingBox()
      assert.equal(after.width, before.width)
      assert.equal(after.height, before.height)
      if (width >= 1024) assert(Math.abs(after.y - before.y) < .5, `Desktop catalogue card must not jump at ${width}px: delta=${after.y - before.y}`)
      else assert(Math.abs(after.y - before.y + 4) < .5, 'Existing mobile hover must remain unchanged')
    }
    // Removing the catalogue scope must restore the shared ProductCard behavior.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.locator('.catalog-listing').evaluate(e => e.classList.remove('catalog-listing'))
    await card.hover()
    await page.waitForTimeout(300)
    assert.equal(await card.evaluate(e => new DOMMatrix(getComputedStyle(e).transform).m42), -4, 'Override must not leak outside catalogue scope')
  }
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ passed: true, engine, check, errors }))
} finally { await browser.close() }
