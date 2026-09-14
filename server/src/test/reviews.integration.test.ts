import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createUser, createGuestSession, authHeader, createProductWithVariant } from './factories'

describe.skipIf(!hasTestDb)('Отзывы (интеграционные)', () => {
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

  it('гость не может создавать отзывы', async () => {
    const guest = await createGuestSession(app)
    const res = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: guest.headers,
      payload: { rating: 5, text: 'Отличный корм для кота!' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toContain('Чтобы оставить отзыв')
  })

  it('авторизованный пользователь создаёт отзыв со статусом pending', async () => {
    const user = await createUser({ name: 'Иван' })
    const headers = authHeader(app, user.id)

    const res = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers,
      payload: { rating: 4, text: 'Хороший корм, кот ест с удовольствием' },
    })

    expect(res.statusCode).toBe(201)
    const review = res.json()
    expect(review.rating).toBe(4)
    expect(review.status).toBe('pending')
    expect(review.authorName).toBe('Иван')
    expect(review.mine).toBe(true)
  })

  it('публичный GET не включает незодобренные отзывы чужие', async () => {
    const user1 = await createUser({ name: 'Александр' })
    const user2 = await createUser({ name: 'Мария' })
    const headers1 = authHeader(app, user1.id)

    // Создан отзыв от user1 со статусом pending
    await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: headers1,
      payload: { rating: 5, text: 'Отличный продукт, очень рекомендую' },
    })

    // user2 не видит его
    const anonRes = await app.inject({ method: 'GET', url: '/api/reviews' })
    expect(anonRes.json().items).toHaveLength(0)
  })

  it('user видит свой отзыв даже если он pending', async () => {
    const user = await createUser({ name: 'Петр' })
    const headers = authHeader(app, user.id)

    const created = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers,
      payload: { rating: 3, text: 'Средний по качеству, ничего особенного' },
    })
    const reviewId = created.json().id

    const listed = await app.inject({ method: 'GET', url: '/api/reviews', headers })
    expect(listed.json().items.length).toBe(1)
    expect(listed.json().items[0].id).toBe(reviewId)
    expect(listed.json().items[0].mine).toBe(true)
  })

  it('одобренный отзыв видна всем', async () => {
    const prisma = getTestPrisma()
    const user = await createUser({ name: 'Константин' })

    // Создадим отзыв со статусом approved минуя API (это админ-функция)
    const review = await prisma.review.create({
      data: {
        authorName: 'Константин',
        rating: 5,
        text: 'Превосходный корм, мой кот ест только это!',
        userId: user.id,
        status: 'approved',
      },
    })

    const res = await app.inject({ method: 'GET', url: '/api/reviews' })
    expect(res.json().items).toHaveLength(1)
    expect(res.json().items[0].id).toBe(review.id)
  })

  it('админ может обновить статус отзыва', async () => {
    const user = await createUser({ name: 'Юлия' })
    const admin = await createUser({ name: 'Админ' })
    const adminHeaders = authHeader(app, admin.id, 'super_admin')

    // user создаёт отзыв
    const created = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: authHeader(app, user.id),
      payload: { rating: 4, text: 'Очень качественный продукт, доставка быстрая' },
    })
    const reviewId = created.json().id

    // админ одобряет
    const updated = await app.inject({
      method: 'PUT',
      url: `/api/admin/reviews/${reviewId}`,
      headers: adminHeaders,
      payload: { status: 'approved' },
    })
    expect(updated.statusCode).toBe(200)
    expect(updated.json().status).toBe('approved')

    // отзыв появляется в публичном списке
    const listed = await app.inject({ method: 'GET', url: '/api/reviews' })
    expect(listed.json().items).toHaveLength(1)
  })

  it('пользователь удаляет свой отзыв', async () => {
    const user = await createUser({ name: 'Дмитрий' })
    const headers = authHeader(app, user.id)

    const created = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers,
      payload: { rating: 2, text: 'Не понравилось, кот отказывается есть' },
    })
    const reviewId = created.json().id

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/reviews/${reviewId}`,
      headers,
    })
    expect(deleted.statusCode).toBe(204)

    const listed = await app.inject({ method: 'GET', url: '/api/reviews', headers })
    expect(listed.json().items).toHaveLength(0)
  })

  it('пользователь не может удалить чужой отзыв', async () => {
    const user1 = await createUser({ name: 'Анна' })
    const user2 = await createUser({ name: 'Борис' })

    const created = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: authHeader(app, user1.id),
      payload: { rating: 5, text: 'Просто супер!' },
    })
    const reviewId = created.json().id

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/reviews/${reviewId}`,
      headers: authHeader(app, user2.id),
    })
    expect(deleted.statusCode).toBe(404)
  })

  it('валидация: rating вне диапазона 1-5 → 400', async () => {
    const user = await createUser()
    const res = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: authHeader(app, user.id),
      payload: { rating: 6, text: 'Этот рейтинг невозможен' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('валидация: text < 10 символов → 400', async () => {
    const user = await createUser()
    const res = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: authHeader(app, user.id),
      payload: { rating: 3, text: 'Ок' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('пару предложений')
  })

  it('анти-спам: более 3 отзывов в час → 429', async () => {
    const user = await createUser()
    const headers = authHeader(app, user.id)

    // Первые три успешны
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        headers,
        payload: { rating: 5 - i, text: `Отзыв номер ${i + 1} с достаточно длинным текстом` },
      })
      expect(res.statusCode).toBe(201)
    }

    // Четвёртый блокируется
    const fourth = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers,
      payload: { rating: 2, text: 'Это уже четвёртый отзыв за час' },
    })
    expect(fourth.statusCode).toBe(429)
    expect(fourth.json().error).toContain('Слишком много')
  })

  it('GET /api/reviews?productId= возвращает только отзывы этого товара', async () => {
    const prisma = getTestPrisma()
    const user = await createUser({ name: 'Тестовый пользователь' })

    // Два товара
    const { product: product1 } = await createProductWithVariant({ name: 'Корм для кошек' })
    const { product: product2 } = await createProductWithVariant({ name: 'Корм для собак' })

    // По одному одобренному отзыву на каждый товар
    await prisma.review.create({
      data: {
        authorName: 'Иван',
        rating: 5,
        text: 'Отличный корм для кошек, кот очень доволен!',
        userId: user.id,
        productId: product1.id,
        status: 'approved',
      },
    })

    await prisma.review.create({
      data: {
        authorName: 'Мария',
        rating: 4,
        text: 'Хороший корм для собак, собака ест с удовольствием',
        userId: user.id,
        productId: product2.id,
        status: 'approved',
      },
    })

    // Запрос с productId первого товара — должен вернуть только его отзыв
    const res = await app.inject({
      method: 'GET',
      url: `/api/reviews?productId=${product1.id}`,
    })
    expect(res.statusCode).toBe(200)
    const data = res.json()
    expect(data.items).toHaveLength(1)
    expect(data.items[0].authorName).toBe('Иван')
    expect(data.total).toBe(1)

    // Запрос без productId — должен вернуть оба одобренных отзыва
    const allRes = await app.inject({
      method: 'GET',
      url: '/api/reviews',
    })
    expect(allRes.statusCode).toBe(200)
    expect(allRes.json().items).toHaveLength(2)
    expect(allRes.json().total).toBe(2)
  })
})
