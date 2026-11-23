// Actual React hook + API adapter; only the network is replaced with deferred responses.
import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'

let browser, bundle
before(async () => {
  const result = await build({
    stdin: {
      contents: `
        import React, { act } from 'react'
        import { createRoot } from 'react-dom/client'
        import { useCatalogFacets } from './src/hooks/useCatalogFacets'
        window.IS_REACT_ACT_ENVIRONMENT = true
        window.requests = []
        window.fetch = url => new Promise((resolve, reject) => window.requests.push({ url, resolve, reject }))
        function Probe({ filters }) {
          const state = useCatalogFacets(filters)
          window.state = { ...state, error: state.error?.code ?? null }
          return React.createElement('pre', null, JSON.stringify(window.state))
        }
        const root = createRoot(document.getElementById('root'))
        window.render = async category => { await act(async () => root.render(React.createElement(Probe, { filters: { category } }))) }
        window.unmount = async () => { await act(async () => root.unmount()) }
        window.settle = async (index, outcome) => {
          await act(async () => {
            const request = window.requests[index]
            if (outcome === 'network') request.reject(new TypeError('Network failure'))
            else request.resolve(new Response(JSON.stringify(outcome === 'error'
              ? { error: { code: 'OLD_FAILURE', message: 'failed' } }
              : { marker: outcome }), { status: outcome === 'error' ? 500 : 200 }))
          })
        }
      `,
      resolveDir: fileURLToPath(new URL('..', import.meta.url)),
      loader: 'jsx',
    },
    bundle: true, write: false, platform: 'browser',
    define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'https://fixture.invalid', DEV: false }), 'process.env.NODE_ENV': '"development"' },
  })
  bundle = result.outputFiles[0].text
  browser = await chromium.launch({ headless: true })
})
after(async () => { await browser?.close() })

async function probe(t) {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(async () => {
    await page.evaluate(() => window.unmount())
    await page.close()
    assert.deepEqual(errors, [], 'Hook fixture must not produce runtime errors')
  })
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ content: bundle })
  await page.evaluate(() => window.render('old'))
  await page.waitForFunction(() => window.requests.length === 1)
  await page.evaluate(() => window.render('new'))
  await page.waitForFunction(() => window.requests.length === 2)
  const urls = await page.evaluate(() => window.requests.map(r => r.url))
  assert.match(urls[0], /category=old/)
  assert.match(urls[1], /category=new/)
  return page
}

test('late failed old request cannot overwrite successful new request error state', async t => {
  const page = await probe(t)
  await page.evaluate(() => window.settle(1, 'fresh'))
  await page.waitForFunction(() => window.state.data?.marker === 'fresh' && !window.state.loading)
  await page.evaluate(() => window.settle(0, 'error'))
  assert.deepEqual(await page.evaluate(() => window.state), { data: { marker: 'fresh' }, loading: false, error: null })
})

test('old failure cannot clear loading while the new request is pending', async t => {
  const page = await probe(t)
  await page.evaluate(() => window.settle(0, 'network'))
  assert.deepEqual(await page.evaluate(() => window.state), { data: null, loading: true, error: null })
  await page.evaluate(() => window.settle(1, 'fresh'))
  await page.waitForFunction(() => window.state.data?.marker === 'fresh' && !window.state.loading)
})

test('old success cannot clear loading or replace data while new request is pending', async t => {
  const page = await probe(t)
  await page.evaluate(() => window.settle(0, 'stale'))
  assert.deepEqual(await page.evaluate(() => window.state), { data: null, loading: true, error: null })
  await page.evaluate(() => window.settle(1, 'fresh'))
  await page.waitForFunction(() => window.state.data?.marker === 'fresh' && !window.state.loading)
})

test('current request errors remain visible and finish loading', async t => {
  const page = await probe(t)
  await page.evaluate(() => window.settle(1, 'error'))
  await page.waitForFunction(() => window.state.error === 'OLD_FAILURE' && !window.state.loading)
  await page.evaluate(() => window.settle(0, 'stale'))
  assert.deepEqual(await page.evaluate(() => window.state), { data: null, loading: false, error: 'OLD_FAILURE' })
})
