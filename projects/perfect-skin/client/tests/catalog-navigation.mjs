// Read-only SPA regression; run against a local VITE_API_MODE=snapshot server.
// PS_E2E_BASE_URL=http://127.0.0.1:5173 ENGINE=webkit node tests/catalog-navigation.mjs
// Requires an installed Playwright browser. PLAYWRIGHT_MODULE can point to an external installation.
import assert from 'node:assert/strict'

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core')
const base = new URL(process.env.PS_E2E_BASE_URL || 'http://127.0.0.1:5173')
assert(['http:', 'https:'].includes(base.protocol), 'Expected an HTTP(S) base URL')
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Use a local snapshot server, not production')
const engine = process.env.ENGINE || 'chromium'
assert(['chromium', 'webkit'].includes(engine), 'ENGINE must be chromium or webkit')
const browser = await ({ chromium, webkit }[engine]).launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
const errors = []
const passed = []
let documentRequests = 0
try {
  await context.route('**/*', route => {
    const request = route.request()
    const url = new URL(request.url())
    // Also block same-origin API proxies: this test needs only the existing snapshot.
    if (url.origin !== base.origin || !['GET', 'HEAD'].includes(request.method()) || url.pathname.startsWith('/api/')) {
      return route.abort()
    }
    return route.continue()
  })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('request', request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests++
  })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (/order of Hooks|Rendered (more|fewer) hooks|changed size between renders|Minified React error #310/i.test(message.text())) {
      errors.push(message.text())
    }
  })
  const healthy = async () => {
    assert.deepEqual(errors, [], 'React runtime/hook errors')
    assert(await page.locator('#root').evaluate(root => root.childElementCount > 0), 'Empty React root')
    assert.equal(documentRequests, 1, 'Navigation must stay in the SPA without reloads')
  }
  const index = async () => {
    await page.waitForURL(`${base.origin}/catalog`)
    await page.getByRole('heading', { name: 'Каталог', exact: true, level: 1 }).waitFor()
    await page.locator('main a[href="/catalog/all"]').waitFor()
    await healthy()
  }
  const listing = async tile => {
    await page.waitForURL(`${base.origin}${tile.href}`)
    await page.getByRole('heading', { name: tile.title, exact: true, level: 1 }).waitFor()
    await page.waitForFunction(() => /Показано\s+\d+\s+из\s+\d+/.test(document.querySelector('main')?.textContent || ''))
    if (tile.href === '/catalog/all' || tile.count > 0) {
      await page.locator('main a[href^="/product/"]').first().waitFor()
    } else {
      await page.getByRole('heading', { name: 'Подберём под вашу кожу', exact: true }).waitFor()
    }
    assert.equal(await page.getByRole('heading', { name: 'Ошибка загрузки', exact: true }).count(), 0)
    await healthy()
  }
  await page.goto(`${base.origin}/catalog`)
  await index()
  const tiles = await page.locator('main a[href^="/catalog/"]').evaluateAll(links => links.map(link => ({
    href: link.getAttribute('href'),
    title: link.querySelector('h2, h3')?.textContent.trim(),
    count: Number(link.querySelector('p')?.textContent.match(/\d+/)?.[0]),
  })))
  assert(tiles.length > 1, 'Expected all-products and category tiles')
  assert.equal(new Set(tiles.map(tile => tile.href)).size, tiles.length, 'Duplicate tile URLs')
  assert(tiles.some(tile => tile.href === '/catalog/all'), 'Missing all-products tile')
  for (const tile of tiles) {
    assert(tile.title && Number.isFinite(tile.count), 'Tile must have a title and product count')
    await page.locator(`main a[href="${tile.href}"]`).click()
    await listing(tile)
    await page.goBack()
    await index()
    await page.goForward()
    await listing(tile)
    await page.goBack()
    await index()
    passed.push(tile.href)
  }
  // Repeat the original failing click after visiting every category.
  const all = tiles.find(tile => tile.href === '/catalog/all')
  await page.locator('main a[href="/catalog/all"]').click()
  await listing(all)
  await page.goBack()
  await index()
  console.log(JSON.stringify({ passed: true, engine, tiles: passed, documentRequests, errors }, null, 2))
} catch (error) {
  console.error(JSON.stringify({ passed: false, engine, completedTiles: passed, errors, failure: error.message }, null, 2))
  process.exitCode = 1
} finally {
  await browser.close()
}
