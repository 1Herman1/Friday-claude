import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createUser, createProductWithVariant, authHeader } from './factories'

describe.skipIf(!hasTestDb)('Admin products (интеграционные)', () => {
  let app: FastifyInstance
  let admin: any

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
    admin = await createUser({ name: 'Admin' })
  })

  it('PUT /:id с species=cat → поле cat, в quizTags есть species:cat и нет species:dog', async () => {
    const { product } = await createProductWithVariant({ name: 'Test product' })

    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/products/${product.id}`,
      headers: authHeader(app, admin.id, 'super_admin'),
      payload: {
        species: 'cat',
      },
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any
    expect(data.species).toBe('cat')
    expect(data.quizTags).toContain('species:cat')
    expect(data.quizTags).not.toContain('species:dog')
  })

  it('PUT /:id с species=dog при существующем species:cat в тегах → тег заменён', async () => {
    const prisma = getTestPrisma()
    const { product } = await createProductWithVariant({ name: 'Test product' })

    // Добавим тег species:cat вручную
    await prisma.product.update({
      where: { id: product.id },
      data: { quizTags: ['species:cat', 'age:adult'] },
    })

    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/products/${product.id}`,
      headers: authHeader(app, admin.id, 'super_admin'),
      payload: {
        species: 'dog',
      },
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any
    expect(data.species).toBe('dog')
    expect(data.quizTags).toContain('species:dog')
    expect(data.quizTags).not.toContain('species:cat')
    expect(data.quizTags).toContain('age:adult')
  })

  it('PUT /:id с species=unknown → тег species:* снят', async () => {
    const prisma = getTestPrisma()
    const created = await createProductWithVariant({ name: 'Test product', species: 'cat' })
    // Фабрика ставит только колонку; тег — как у товара, размеченного бэкфиллом.
    const product = await prisma.product.update({
      where: { id: created.product.id },
      data: { quizTags: ['species:cat'] },
    })
    expect(product.quizTags).toContain('species:cat')

    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/products/${product.id}`,
      headers: authHeader(app, admin.id, 'super_admin'),
      payload: {
        species: 'unknown',
      },
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any
    expect(data.species).toBe('unknown')
    expect(data.quizTags).not.toContain('species:cat')
    expect(data.quizTags).not.toContain('species:dog')
  })

  it('PUT /:id с species=both с quizTags в том же запросе → переданные теги сохранены, species:* нет', async () => {
    const { product } = await createProductWithVariant({ name: 'Test product' })

    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/products/${product.id}`,
      headers: authHeader(app, admin.id, 'super_admin'),
      payload: {
        species: 'both',
        quizTags: ['age:adult', 'size:small'],
      },
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any
    expect(data.species).toBe('both')
    expect(data.quizTags).toContain('age:adult')
    expect(data.quizTags).toContain('size:small')
    expect(data.quizTags).not.toContain('species:cat')
    expect(data.quizTags).not.toContain('species:dog')
    expect(data.quizTags).not.toContain('species:both')
  })

  it('GET /api/admin/products?species=unknown → только такие товары', async () => {
    await createProductWithVariant({ name: 'Корм для кошек', species: 'cat' })
    await createProductWithVariant({ name: 'Корм для собак', species: 'dog' })
    await createProductWithVariant({ name: 'Миска универсальная', species: 'both' })
    await createProductWithVariant({ name: 'Товар без разметки', species: 'unknown' })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/products?species=unknown',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any
    expect(data.items).toHaveLength(1)
    expect(data.items[0].name).toBe('Товар без разметки')
    expect(data.items[0].species).toBe('unknown')
  })

  it('GET /api/admin/products?species=cat → только кошки', async () => {
    await createProductWithVariant({ name: 'Корм для кошек', species: 'cat' })
    await createProductWithVariant({ name: 'Корм для собак', species: 'dog' })
    await createProductWithVariant({ name: 'Товар без разметки', species: 'unknown' })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/products?species=cat',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any
    expect(data.items).toHaveLength(1)
    expect(data.items[0].name).toBe('Корм для кошек')
    expect(data.items[0].species).toBe('cat')
  })

  it('GET /:id возвращает species и quizTags', async () => {
    const { product } = await createProductWithVariant({ name: 'Test product', species: 'dog' })

    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/products/${product.id}`,
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any
    expect(data.species).toBe('dog')
    expect(data.quizTags).toBeDefined()
    expect(Array.isArray(data.quizTags)).toBe(true)
  })

  it('POST / с species=cat → создаёт товар с правильным species и тегами', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/products',
      headers: authHeader(app, admin.id, 'super_admin'),
      payload: {
        name: 'New product',
        slug: 'new-product',
        description: 'Test description',
        species: 'cat',
        quizTags: ['age:adult'],
        variants: [{ weight: 1, price: 99900 }],
      },
    })

    expect(res.statusCode).toBe(201)
    const data = res.json() as any
    expect(data.species).toBe('cat')
    expect(data.quizTags).toContain('species:cat')
    expect(data.quizTags).toContain('age:adult')
  })

  it('PUT /:id с невалидным species → 400', async () => {
    const { product } = await createProductWithVariant({ name: 'Test product' })

    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/products/${product.id}`,
      headers: authHeader(app, admin.id, 'super_admin'),
      payload: {
        species: 'invalid_species',
      },
    })

    expect(res.statusCode).toBe(400)
  })
})
