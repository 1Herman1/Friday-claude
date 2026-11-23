// Read-only navigation regression. BASE_URL, BROWSER, OUT_DIR, DELAY_MS are optional.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, webkit } from 'playwright-core'
const base = process.env.BASE_URL || 'http://localhost:5173'
const engine = process.env.BROWSER || 'chromium'
const out = process.env.OUT_DIR || `${process.env.TMPDIR || '.'}/ps-navigation-${engine}`
await mkdir(out, { recursive: true })
const browser = await ({ chromium, webkit }[engine]).launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordHar: { path: `${out}/navigation.har`, mode: 'full', content: 'omit' },
})
const page = await context.newPage()
const evidence = { base, engine, errors: [], console: [], network: [], states: [], documents: [],
  cacheCoverage: 'Fresh context; read-only request routing disables HTTP cache. Repeat navigation tests module reuse, NOT a stale pre-deploy browser cache.',
}
const pending = new Set()
page.on('pageerror', e => evidence.errors.push(e.stack || e.message || String(e)))
page.on('console', m => { if (['error', 'warning'].includes(m.type())) evidence.console.push(m.text()) })
page.on('request', r => { pending.add(r.url()); if (r.isNavigationRequest() && r.frame() === page.mainFrame()) evidence.documents.push(r.url()) })
page.on('requestfinished', r => pending.delete(r.url()))
page.on('requestfailed', r => { pending.delete(r.url()); evidence.network.push({ url: r.url(), failure: r.failure() }) })
page.on('response', r => { if (r.status() >= 400 || ['fetch', 'xhr', 'script'].includes(r.request().resourceType())) evidence.network.push({ url: r.url(), status: r.status() }) })
await context.route('**/*', async route => {
  const r = route.request()
  if (!['GET', 'HEAD'].includes(r.method()) || new URL(r.url()).origin !== new URL(base).origin) return route.abort()
  if (process.env.NEGATIVE_CONTROL === 'chunk' && /CatalogPage.*\.js/.test(r.url())) return route.abort()
  if (Number(process.env.DELAY_MS) && /CatalogPage.*\.js|\/api\/v1\/categories/.test(r.url())) await new Promise(r => setTimeout(r, Number(process.env.DELAY_MS)))
  await route.continue()
})
async function state(label) {
  evidence.states.push({ label, pending: [...pending], ...await page.evaluate(() => ({
    url: location.href, rootChildren: document.querySelector('#root')?.childElementCount,
    rootText: document.querySelector('#root')?.textContent?.slice(0, 800),
    headings: [...document.querySelectorAll('h1')].map(x => x.textContent),
    overflow: [getComputedStyle(document.body).overflow, getComputedStyle(document.documentElement).overflow],
    overlays: [...document.querySelectorAll('[role=dialog],[aria-modal=true]')].map(x => ({ text: x.textContent?.slice(0, 100), visible: !!x.getClientRects().length })),
    center: document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.outerHTML.slice(0, 400),
    scripts: [...document.scripts].map(x => x.src),
    serviceWorker: navigator.serviceWorker?.controller?.scriptURL ?? null,
    scriptResources: performance.getEntriesByType('resource')
      .filter(x => /\.js(?:\?|$)/.test(x.name))
      .map(x => ({ url: x.name, transferSize: x.transferSize, duration: x.duration })),
  })) })
  await page.screenshot({ path: `${out}/${label}.png` })
}
async function catalog(label) {
  await page.waitForFunction(() => location.pathname === '/catalog' && [...document.querySelectorAll('h1')].some(x => x.textContent.includes('Каталог')), null, { timeout: 15000 })
  await page.locator('main a[href^="/catalog/"]').first().waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(350)
  await state(label)
  assert.equal(evidence.errors.length, 0, evidence.errors.join('\n'))
  assert.equal(evidence.documents.length, 1, 'Client navigation must not reload the document')
  assert.ok(await page.locator('#root').innerText(), 'Root must not be empty')
}
try {
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.locator('h1').waitFor()
  await page.waitForTimeout(Number(process.env.HOME_WAIT_MS || 0))
  await state('home')
  const entry = process.env.ENTRY_SELECTOR || 'header a[href="/catalog"]'
  await page.locator(entry).first().click()
  await catalog('catalog')
  await page.goBack()
  await page.waitForFunction(() => location.pathname === '/' && !!document.querySelector('h1'))
  await state('back')
  await page.goForward()
  await catalog('forward')
  await page.goBack()
  await page.locator('header').getByRole('link', { name: 'Каталог', exact: true }).click()
  await catalog('repeat')
  evidence.pass = true
} catch (e) {
  evidence.pass = false
  evidence.failure = e.stack
  await state('failure').catch(() => {})
  process.exitCode = 1
} finally {
  await writeFile(`${out}/evidence.json`, JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify({ pass: evidence.pass, errors: evidence.errors, failure: evidence.failure, documents: evidence.documents, out }, null, 2))
  await context.close() // Flush HAR even on a failed transition, before closing the browser.
  await browser.close()
}
