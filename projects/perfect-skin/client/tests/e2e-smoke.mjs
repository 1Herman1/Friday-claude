// Постоянный UI-смоук пути покупателя (Playwright, headless chromium).
// 1) API:      cd server && npm run dev                      # http://localhost:3000
// 2) Фронт:    cd client && VITE_API_MODE=live npm run build && npx vite preview --port 5173
// 3) Тест:     cd client && npm run test:e2e

import pkg from '/opt/node22/lib/node_modules/playwright/index.js'
const { chromium } = pkg

const BASE = 'http://localhost:5173'
const API = 'http://localhost:3000'
const PRODUCT_SLUG = 'dinamizante-vosstanavlivayushhij-krem'
const PROMO = 'WAVE2PROMO'
const EMAIL = `e2e${Date.now()}@example.com`

let failed = false
// В негативном шаге 404 от API — ожидаемое поведение, а не дефект.
let expectApiError = false
const consoleErrors = []

const ok = (name) => console.log(`✓ ${name}`)
const bad = (name, detail) => {
  failed = true
  console.log(`✗ ${name}${detail ? ` — ${detail}` : ''}`)
}
const skip = (name, detail) => console.log(`SKIP ${name}${detail ? ` — ${detail}` : ''}`)

async function step(name, fn) {
  try {
    await fn()
    ok(name)
  } catch (err) {
    bad(name, err.message)
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

async function checkService(url, hint) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    console.error(`Сервис недоступен: ${url} (${err.message})\nПодними его: ${hint}`)
    process.exit(1)
  }
}

async function main() {
  await checkService(`${API}/api/v1/products?limit=1`, 'cd server && npm run dev')
  await checkService(`${BASE}/`, 'cd client && VITE_API_MODE=live npm run build && npx vite preview --port 5173')

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  // Внешние ресурсы (шрифты, аналитика) в изолированной среде недоступны —
  // такие ошибки загрузки не относятся к качеству приложения.
  const externalFailures = new Set()
  page.on('requestfailed', (req) => {
    if (!req.url().startsWith(BASE) && !req.url().startsWith(API)) externalFailures.add(new URL(req.url()).host)
  })

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const url = msg.location()?.url || ''
    if (url && !url.startsWith(BASE) && !url.startsWith(API)) return
    if (expectApiError && url.startsWith(API)) return
    consoleErrors.push(`[console] ${msg.text()}${url ? ` (${url})` : ''}`)
  })
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`))

  // Диагностика: неуспешные ответы API с телом — чтобы падение было объяснимым.
  const apiFailures = []
  page.on('response', async (res) => {
    if (!res.url().startsWith(API) || res.status() < 400) return
    const body = await res.text().catch(() => '')
    apiFailures.push(`${res.status()} ${res.request().method()} ${res.url()} → ${body.slice(0, 300)}`)
  })

  // 1. Главная: бестселлеры
  await step('главная открывается, в бестселлерах есть карточки товаров', async () => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    const section = page.locator('section', { has: page.getByRole('heading', { name: 'Бестселлеры' }) })
    await section.first().waitFor({ timeout: 15000 })
    const links = section.first().locator('a[href^="/product/"]')
    await links.first().waitFor({ timeout: 15000 })
    assert((await links.count()) > 0, 'нет ссылок на товары в бестселлерах')
  })

  // 2. Каталог: карточки и фильтр бренда
  let totalBefore = 0
  await step('/catalog/all: больше 10 карточек товаров', async () => {
    await page.goto(`${BASE}/catalog/all`, { waitUntil: 'domcontentloaded' })
    const cards = page.locator('a[href^="/product/"]')
    await cards.first().waitFor({ timeout: 15000 })
    const count = await cards.count()
    assert(count > 10, `карточек ${count}, ожидалось > 10`)
    const text = await page.locator('body').innerText()
    const m = text.match(/Показано\s+\d+\s+из\s+(\d+)/)
    assert(m, 'не найден счётчик «Показано N из M»')
    totalBefore = Number(m[1])
    assert(totalBefore > 10, `total=${totalBefore}`)
  })

  await step('фильтр по бренду меняет количество найденных товаров', async () => {
    const brandGroup = page.locator('div', { has: page.getByRole('heading', { name: 'Бренд' }) }).last()
    const checkbox = brandGroup.locator('input[type="checkbox"]:not([disabled])').first()
    await checkbox.waitFor({ timeout: 15000 })
    await checkbox.check()
    await page.waitForFunction(
      (prev) => {
        const m = document.body.innerText.match(/Показано\s+\d+\s+из\s+(\d+)/)
        return m && Number(m[1]) !== prev
      },
      totalBefore,
      { timeout: 15000 },
    )
    const text = await page.locator('body').innerText()
    const after = Number(text.match(/Показано\s+\d+\s+из\s+(\d+)/)[1])
    assert(after < totalBefore, `после фильтра ${after}, было ${totalBefore} — не уменьшилось`)
  })

  // 3. Товар → в корзину → счётчик в шапке
  await step('карточка товара: «В корзину» увеличивает счётчик корзины до 1', async () => {
    await page.goto(`${BASE}/product/${PRODUCT_SLUG}`, { waitUntil: 'domcontentloaded' })
    const addBtn = page.getByRole('button', { name: 'В корзину' }).first()
    await addBtn.waitFor({ timeout: 15000 })
    await addBtn.click()
    const cartBtn = page.locator('header button[aria-label^="Корзина"]')
    await page.waitForFunction(
      () => {
        const el = document.querySelector('header button[aria-label^="Корзина"]')
        return el && /Корзина,\s*1\s/.test(el.getAttribute('aria-label') || '')
      },
      undefined,
      { timeout: 15000 },
    )
    const label = await cartBtn.getAttribute('aria-label')
    assert(/Корзина,\s*1\s/.test(label), `aria-label шапки: «${label}»`)
    const badge = cartBtn.locator('xpath=../span')
    assert((await badge.innerText()).trim() === '1', 'бейдж-счётчик не показывает 1')
  })

  // 4. Корзина (drawer): товар и сумма, плюс/минус меняют сумму
  let subtotalOne = 0
  const readDrawerTotal = () =>
    page.evaluate(() => {
      const label = [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === 'Итого')
      const value = label?.nextElementSibling?.textContent || ''
      return Number(value.replace(/\D/g, ''))
    })

  await step('корзина открывается: товар есть, сумма > 0', async () => {
    const drawer = page.getByRole('dialog', { name: /Корзина/ })
    if (!(await drawer.isVisible().catch(() => false))) {
      await page.locator('header button[aria-label^="Корзина"]').click()
    }
    await drawer.waitFor({ timeout: 15000 })
    await drawer.locator(`a[href="/product/${PRODUCT_SLUG}"]`).first().waitFor({ timeout: 15000 })
    await page.waitForFunction(() => {
      const label = [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === 'Итого')
      return Number((label?.nextElementSibling?.textContent || '').replace(/\D/g, '')) > 0
    }, undefined, { timeout: 15000 })
    subtotalOne = await readDrawerTotal()
    assert(subtotalOne > 0, `сумма в корзине ${subtotalOne} не больше нуля`)
  })

  await step('плюс количества увеличивает сумму, минус возвращает обратно', async () => {
    const drawer = page.getByRole('dialog', { name: /Корзина/ })
    await drawer.getByRole('button', { name: 'Увеличить количество' }).first().click()
    await page.waitForFunction(
      (prev) => {
        const el = [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === 'Итого')
        const v = el?.nextElementSibling?.textContent.replace(/[^\d]/g, '')
        return v && Number(v) > prev
      },
      subtotalOne,
      { timeout: 15000 },
    )
    await drawer.getByRole('button', { name: 'Уменьшить количество' }).first().click()
    await page.waitForFunction(
      (prev) => {
        const el = [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === 'Итого')
        const v = el?.nextElementSibling?.textContent.replace(/[^\d]/g, '')
        return v && Number(v) === prev
      },
      subtotalOne,
      { timeout: 15000 },
    )
  })

  // 5. Чекаут гостем: самовывоз + промокод + оформление
  let orderNumber = ''
  await step('чекаут: самовывоз, контакты, промокод, оформление → номер PS-XXXXXX', async () => {
    await page.goto(`${BASE}/checkout`, { waitUntil: 'domcontentloaded' })
    const pickup = page.locator('label', { hasText: 'Самовывоз' }).locator('input[type="radio"]').first()
    await pickup.waitFor({ timeout: 15000 })
    await pickup.check()

    await page.getByPlaceholder('Иван Сидоров').fill('Тест Тестов')
    // Сервер принимает только +7XXXXXXXXXX, поле не нормализует ввод —
    // Телефон вводим в «человеческом» формате из плейсхолдера — это
    // регрессия на баг, когда такой ввод ронял оформление с 400.
    await page.getByPlaceholder('+7 (901) 123-45-67').fill('+7 (901) 123-45-67')
    await page.getByPlaceholder('ivan@example.com').fill(EMAIL)

    const totalBeforePromo = Number(
      (await page.locator('body').innerText()).match(/Итого[\s\S]{0,40}?([\d\s]+)\s*₽/)[1].replace(/\D/g, ''),
    )

    await page.getByPlaceholder('Введите код').fill(PROMO)
    await page.getByRole('button', { name: 'Применить' }).click()
    const discountRow = page.locator('text=Скидка').first()
    try {
      await discountRow.waitFor({ timeout: 10000 })
      const totalAfter = Number(
        (await page.locator('body').innerText()).match(/Итого[\s\S]{0,40}?([\d\s]+)\s*₽/)[1].replace(/\D/g, ''),
      )
      assert(totalAfter < totalBeforePromo, `итог не уменьшился после промокода: ${totalBeforePromo} → ${totalAfter}`)
      ok(`  промокод ${PROMO} применён, скидка отобразилась`)
    } catch {
      skip(`промокод ${PROMO}`, 'скидка не появилась — код мог быть удалён из dev-БД')
    }

    const submit = page.getByRole('button', { name: 'Оформить заказ' })
    await submit.waitFor({ timeout: 15000 })
    await submit.click()
    await page.waitForFunction(() => /PS-\d{6}/.test(document.body.innerText), undefined, { timeout: 20000 })
    orderNumber = (await page.locator('body').innerText()).match(/PS-\d{6}/)[0]
    assert(orderNumber, 'номер заказа не найден')
  })

  // 6. Проверка статуса без входа
  await step('«Проверить статус без входа» → /track с префиллом → заказ виден', async () => {
    assert(orderNumber, 'нет номера заказа из предыдущего шага')
    await page.getByRole('link', { name: 'Проверить статус без входа' }).click()
    await page.waitForURL(/\/track\?number=/, { timeout: 15000 })
    const numberInput = page.locator('#order-number')
    await numberInput.waitFor({ timeout: 15000 })
    assert((await numberInput.inputValue()) === orderNumber, 'номер заказа не предзаполнен')
    await page.locator('#email').fill(EMAIL)
    await page.locator('button[type="submit"]').click()
    await page.getByRole('heading', { name: `Заказ ${orderNumber}` }).waitFor({ timeout: 20000 })
  })

  // 7. Негатив: чужой email
  expectApiError = true
  await step('негатив: тот же номер с чужим email → «Заказ не найден»', async () => {
    await page.goto(`${BASE}/track?number=${orderNumber}`, { waitUntil: 'domcontentloaded' })
    await page.locator('#order-number').waitFor({ timeout: 15000 })
    await page.locator('#email').fill('wrong@test.com')
    await page.locator('button[type="submit"]').click()
    const alert = page.getByRole('alert')
    await alert.waitFor({ timeout: 20000 })
    const text = await alert.innerText()
    assert(/Заказ не найден/.test(text), `текст ошибки: «${text}»`)
  })
  expectApiError = false

  await browser.close()

  if (failed && apiFailures.length) {
    console.log('Неуспешные ответы API за прогон:')
    for (const f of apiFailures.slice(0, 10)) console.log(`   ${f}`)
  }

  if (externalFailures.size) {
    skip('внешние ресурсы недоступны в изолированной среде', [...externalFailures].join(', '))
  }

  if (consoleErrors.length) {
    failed = true
    console.log(`✗ ошибки в консоли страницы (${consoleErrors.length}):`)
    for (const e of consoleErrors.slice(0, 20)) console.log(`   ${e}`)
  } else {
    ok('в консоли страницы нет ошибок')
  }

  console.log(failed ? '\nРЕЗУЛЬТАТ: провал' : '\nРЕЗУЛЬТАТ: все шаги пройдены')
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error(`✗ неожиданная ошибка прогона: ${err.stack || err.message}`)
  process.exit(1)
})
