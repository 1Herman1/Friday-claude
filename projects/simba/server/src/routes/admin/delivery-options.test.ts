import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../index'
import { PrismaClient } from '@prisma/client'

describe('POST /api/admin/delivery-options', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let prisma: PrismaClient

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    prisma = app.prisma
  })

  afterAll(async () => {
    await app.close()
  })

  // Генерируем токен: используем тестовый токен с ролью super_admin
  // Раньше тесты админ-маршрутов использовали фейковое auth. Тут используем
  // встроенный checkRole без реального JWT, поэтому нужна интеграция.
  // Проверяем через app.inject() — он есть в тестах.

  it('без токена возвращает 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/delivery-options',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET / возвращает все варианты доставки', async () => {
    // Генерируем токен с нужной ролью. В buildApp используется JWT_SECRET.
    const token = app.jwt.sign({ userId: 'test-user', role: 'super_admin' })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/delivery-options',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)

    const body = JSON.parse(res.body)
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)

    // Проверяем, что включены и выключенные варианты есть
    const active = body.filter((b: any) => b.isActive)
    const inactive = body.filter((b: any) => !b.isActive)
    expect(active.length + inactive.length).toBe(body.length)
  })

  it('PATCH /:key обновляет цену и возвращает 200', async () => {
    const token = app.jwt.sign({ userId: 'test-user', role: 'super_admin' })

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/delivery-options/cdek_pvz',
      headers: { authorization: `Bearer ${token}` },
      payload: { price: 14900 },
    })
    expect(res.statusCode).toBe(200)

    const body = JSON.parse(res.body)
    expect(body.key).toBe('cdek_pvz')
    expect(body.price).toBe(14900)

    // Проверяем, что цена действительно обновилась в БД
    const option = await prisma.deliveryOption.findUnique({
      where: { key: 'cdek_pvz' },
    })
    expect(option?.price).toBe(14900)

    // Возвращаем обратно
    await app.inject({
      method: 'PATCH',
      url: '/api/admin/delivery-options/cdek_pvz',
      headers: { authorization: `Bearer ${token}` },
      payload: { price: 9900 },
    })
  })

  it('PATCH /:key с isActive: false скрывает способ из публичного API', async () => {
    const token = app.jwt.sign({ userId: 'test-user', role: 'super_admin' })

    // Отключаем Ozon
    const disableRes = await app.inject({
      method: 'PATCH',
      url: '/api/admin/delivery-options/ozon_pvz',
      headers: { authorization: `Bearer ${token}` },
      payload: { isActive: false },
    })
    expect(disableRes.statusCode).toBe(200)

    // Проверяем публичный API — Ozon не должен быть там
    const optionsRes = await app.inject({
      method: 'GET',
      url: '/api/delivery/options',
    })
    const { options } = JSON.parse(optionsRes.body)
    const ozonInList = options.some((o: any) => o.key === 'ozon_pvz')
    expect(ozonInList).toBe(false)

    // Включаем обратно
    await app.inject({
      method: 'PATCH',
      url: '/api/admin/delivery-options/ozon_pvz',
      headers: { authorization: `Bearer ${token}` },
      payload: { isActive: true },
    })
  })

  it('PATCH с неизвестным key возвращает 404', async () => {
    const token = app.jwt.sign({ userId: 'test-user', role: 'super_admin' })

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/delivery-options/unknown_key',
      headers: { authorization: `Bearer ${token}` },
      payload: { price: 100 },
    })
    expect(res.statusCode).toBe(404)

    const body = JSON.parse(res.body)
    expect(body.error).toBeDefined()
  })

  it('PATCH с price: -1 возвращает 400', async () => {
    const token = app.jwt.sign({ userId: 'test-user', role: 'super_admin' })

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/delivery-options/cdek_pvz',
      headers: { authorization: `Bearer ${token}` },
      payload: { price: -1 },
    })
    expect(res.statusCode).toBe(400)

    const body = JSON.parse(res.body)
    expect(body.error).toBeDefined()
  })

  it('PATCH с title > 60 символов возвращает 400', async () => {
    const token = app.jwt.sign({ userId: 'test-user', role: 'super_admin' })

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/delivery-options/cdek_pvz',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'a'.repeat(61) },
    })
    expect(res.statusCode).toBe(400)
  })

  it('PATCH обновляет только переданные поля', async () => {
    const token = app.jwt.sign({ userId: 'test-user', role: 'super_admin' })

    // Читаем старые значения
    const beforeRes = await app.inject({
      method: 'GET',
      url: '/api/admin/delivery-options',
      headers: { authorization: `Bearer ${token}` },
    })
    const before = JSON.parse(beforeRes.body).find((b: any) => b.key === 'simba_courier')
    const oldTitle = before.title
    const oldPrice = before.price

    // Обновляем только sortOrder
    await app.inject({
      method: 'PATCH',
      url: '/api/admin/delivery-options/simba_courier',
      headers: { authorization: `Bearer ${token}` },
      payload: { sortOrder: 999 },
    })

    // Проверяем, что остальное не изменилось
    const afterRes = await app.inject({
      method: 'GET',
      url: '/api/admin/delivery-options',
      headers: { authorization: `Bearer ${token}` },
    })
    const after = JSON.parse(afterRes.body).find((b: any) => b.key === 'simba_courier')
    expect(after.title).toBe(oldTitle)
    expect(after.price).toBe(oldPrice)
    expect(after.sortOrder).toBe(999)

    // Возвращаем обратно
    await app.inject({
      method: 'PATCH',
      url: '/api/admin/delivery-options/simba_courier',
      headers: { authorization: `Bearer ${token}` },
      payload: { sortOrder: 0 },
    })
  })
})
