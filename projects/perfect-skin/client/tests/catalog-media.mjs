// Local snapshot only: media behavior, resilient failures and responsive fallback.
import assert from 'node:assert/strict'
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core')
const base = new URL(process.env.PS_E2E_BASE_URL || 'http://127.0.0.1:5193')
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))
const engine = process.env.ENGINE || 'chromium'
const browser = await ({ chromium, webkit }[engine]).launch({ headless: true })
const passed = []
async function scenario(name, options, check) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', reducedMotion: options.reduced ? 'reduce' : 'no-preference' })
  if (options.saveData) await context.addInitScript(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true, addEventListener() {}, removeEventListener() {} } }))
  const errors = [], videos = []
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.pathname.endsWith('.mp4')) videos.push(url.pathname)
    if (url.origin !== base.origin || url.pathname.startsWith('/api/') || !['GET','HEAD'].includes(request.method()) || options.fail?.(url.pathname)) return route.abort()
    return route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  try {
    await page.goto(base.origin + '/catalog')
    await page.locator('.catalog-editorial').waitFor()
    await check(page, videos)
    assert.deepEqual(errors, [], name + ': runtime errors')
    passed.push(name)
  } finally { await context.close() }
}
try {
  await scenario('video plays, user pause, replay, offscreen pause', {}, async page => {
    const video = page.locator('.catalog-bestsellers video')
    await page.waitForFunction(() => document.querySelector('.catalog-bestsellers video')?.currentTime > .1)
    await page.getByRole('button', { name: 'Приостановить видео' }).click()
    const time = await video.evaluate(v => v.currentTime)
    await page.waitForTimeout(400)
    assert.equal(await video.evaluate(v => v.currentTime), time)
    await page.getByRole('button', { name: 'Продолжить видео' }).click()
    await page.getByRole('button', { name: 'Повторить видео' }).waitFor()
    assert(await video.evaluate(v => v.ended && !v.loop))
    await page.getByRole('button', { name: 'Повторить видео' }).click()
    await page.waitForFunction(() => { const v = document.querySelector('.catalog-bestsellers video'); return v && !v.paused && v.currentTime < 2 })
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(400)
    assert(await video.evaluate(v => v.paused), 'Offscreen video pauses')
  })
  for (const mode of ['reduced', 'saveData']) await scenario('initial ' + mode, { [mode]: true }, async (page, videos) => {
    const initial = await page.locator('.catalog-packshot[data-active="true"]').getAttribute('src')
    await page.waitForTimeout(5200)
    assert.equal(await page.locator('.catalog-packshot[data-active="true"]').getAttribute('src'), initial)
    assert.deepEqual(videos, [], 'Static preference must avoid video request')
    assert.equal(await page.locator('.catalog-motion-control').count(), 0)
  })
  await scenario('failed image and video keep working links', { fail: path => path.endsWith('.mp4') || path.includes('4d-hyal-cross') }, async page => {
    await page.waitForFunction(() => !document.querySelector('.catalog-bestsellers video'))
    assert(await page.locator('.catalog-bestsellers img').evaluate(i => i.complete && i.naturalWidth > 0))
    await page.waitForTimeout(5200)
    assert(await page.locator('.catalog-packshot[data-active="true"]').evaluate(i => i.complete && i.naturalWidth > 0))
    await page.locator('main a[href="/catalog/all?sort=popular"]').click()
    await page.waitForURL('**/catalog/all?sort=popular')
    assert.equal(await page.locator('h1').innerText(), 'Каталог Perfect Skin')
  })
  await scenario('mobile and desktop breakpoint switching', {}, async page => {
    for (const width of [390, 820, 1440, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await page.waitForTimeout(100)
      assert.equal(await page.locator('.catalog-editorial').count(), width >= 1024 ? 1 : 0)
      if (width < 1024) assert.equal(await page.locator('main video').count(), 0)
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    }
  })
  console.log(JSON.stringify({ passed: true, engine, scenarios: passed }, null, 2))
} finally { await browser.close() }
