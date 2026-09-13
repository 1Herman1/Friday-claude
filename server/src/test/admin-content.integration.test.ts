import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createUser, authHeader, seedDeliveryOptions } from './factories'

describe.skipIf(!hasTestDb)('Блог, тексты сайта, визиты, бесплатная доставка (интеграционные)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    const { buildApp } = await import('../index')
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    if (app) await app.close()
    await closeTestPrisma()
  })

  beforeEach(async () => {
    await resetDb()
  })

  const post = { slug: 'test-post', title: 'Тест', subtitle: 'Подзаголовок', body: '## Раздел\n\nТекст статьи. '.repeat(50), categories: ['Кошки'], date: '2026-09-01' }

  it('блог: черновик не виден публично, публикация — виден, readingMinutes считается', async () => {
    const admin = await createUser({ name: 'Admin' })
    const headers = authHeader(app, admin.id, 'super_admin')

    const created = await app.inject({ method: 'POST', url: '/api/admin/blog', headers, payload: post })
    expect(created.statusCode).toBe(201)
    const id = created.json().id
    expect(created.json().status).toBe('draft')
    expect(created.json().readingMinutes).toBeGreaterThanOrEqual(1)

    const hidden = await app.inject({ method: 'GET', url: '/api/blog/test-post' })
    expect(hidden.statusCode).toBe(404)

    const updated = await app.inject({ method: 'PUT', url: `/api/admin/blog/${id}`, headers, payload: { ...post, status: 'published' } })
    expect(updated.statusCode).toBe(200)

    const visible = await app.inject({ method: 'GET', url: '/api/blog/test-post' })
    expect(visible.statusCode).toBe(200)
    expect(visible.json().title).toBe('Тест')

    const list = await app.inject({ method: 'GET', url: '/api/blog' })
    expect(list.json().items).toHaveLength(1)
  })

  it('блог: покупателю админка закрыта, дубликат слага — 409', async () => {
    const admin = await createUser({ name: 'Admin' })
    const customer = await createUser({ name: 'Customer' })
    const headers = authHeader(app, admin.id, 'products_manager')

    const denied = await app.inject({ method: 'POST', url: '/api/admin/blog', headers: authHeader(app, customer.id), payload: post })
    expect(denied.statusCode).toBe(403)

    expect((await app.inject({ method: 'POST', url: '/api/admin/blog', headers, payload: post })).statusCode).toBe(201)
    const dup = await app.inject({ method: 'POST', url: '/api/admin/blog', headers, payload: post })
    expect(dup.statusCode).toBe(409)
  })

  it('тексты сайта: переопределение видно публично, reset возвращает стандарт', async () => {
    const admin = await createUser({ name: 'Admin' })
    const headers = authHeader(app, admin.id, 'super_admin')

    const before = await app.inject({ method: 'GET', url: '/api/site-texts' })
    expect(before.statusCode).toBe(200)
    expect(before.json().texts['home.categories.title']).toBeUndefined()

    const put = await app.inject({ method: 'PUT', url: '/api/admin/site-texts/home.categories.title', headers, payload: { value: 'Разделы' } })
    expect(put.statusCode).toBe(200)
    expect(put.json().isOverridden).toBe(true)

    const after = await app.inject({ method: 'GET', url: '/api/site-texts' })
    expect(after.json().texts['home.categories.title']).toBe('Разделы')

    const unknown = await app.inject({ method: 'PUT', url: '/api/admin/site-texts/nope.key', headers, payload: { value: 'x' } })
    expect(unknown.statusCode).toBe(404)

    const reset = await app.inject({ method: 'POST', url: '/api/admin/site-texts/reset/home.categories.title', headers })
    expect(reset.statusCode).toBe(200)
    expect(reset.json().isOverridden).toBe(false)
    expect(reset.json().value).toBe('Категории')
  })

  it('визиты: ping считает по дням и попадает в дашборд', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin' })
    const headers = authHeader(app, admin.id, 'super_admin')

    expect((await app.inject({ method: 'POST', url: '/api/visits' })).statusCode).toBe(204)
    expect((await app.inject({ method: 'POST', url: '/api/visits' })).statusCode).toBe(204)
    const rows = await prisma.siteVisit.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0].count).toBe(2)

    const dash = await app.inject({ method: 'GET', url: '/api/admin/dashboard?period=week', headers })
    expect(dash.statusCode).toBe(200)
    expect(dash.json().period.visits).toBe(2)
  })

  it('доставка: freeFrom обнуляет цену котировки при достаточной сумме', async () => {
    const prisma = getTestPrisma()
    await seedDeliveryOptions()
    await prisma.deliveryOption.update({ where: { key: 'simba_courier' }, data: { freeFrom: 300000, etaMin: 0, etaMax: 1 } })

    const options = await app.inject({ method: 'GET', url: '/api/delivery/options' })
    const courier = options.json().options.find((o: { key: string }) => o.key === 'simba_courier')
    expect(courier.freeFrom).toBe(300000)
    expect(courier.etaMax).toBe(1)

    const paid = await app.inject({ method: 'POST', url: '/api/delivery/quotes', payload: { city: 'Москва', weightKg: 1, subtotal: 100000 } })
    expect(paid.statusCode).toBe(200)
    const paidCourier = paid.json().quotes.find((q: { key: string }) => q.key === 'simba_courier')
    expect(paidCourier.price).toBe(70000)

    const free = await app.inject({ method: 'POST', url: '/api/delivery/quotes', payload: { city: 'Москва', weightKg: 1, subtotal: 300000 } })
    const freeCourier = free.json().quotes.find((q: { key: string }) => q.key === 'simba_courier')
    expect(freeCourier.price).toBe(0)
    expect(freeCourier.freeFrom).toBe(300000)
  })
})
