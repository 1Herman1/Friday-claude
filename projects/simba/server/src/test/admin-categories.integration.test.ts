import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { hasTestDb, skipReason, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createUser, authHeader } from './factories'

describe.skipIf(!hasTestDb)('Admin categories (интеграционные)', () => {
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

  it('GET / возвращает дерево всех категорий с неактивными', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin' })

    // Create categories
    const cat1 = await prisma.category.create({
      data: { name: 'Cat 1', slug: 'cat-1', isActive: true, sortOrder: 1 },
    })

    const cat2 = await prisma.category.create({
      data: { name: 'Cat 2', slug: 'cat-2', isActive: false, sortOrder: 2 },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/categories',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any
    expect(data.items).toBeDefined()
    expect(data.items.length).toBeGreaterThanOrEqual(2)

    const item1 = data.items.find((i: any) => i.id === cat1.id)
    const item2 = data.items.find((i: any) => i.id === cat2.id)

    expect(item1.isActive).toBe(true)
    expect(item2.isActive).toBe(false)
    expect(item1.productCount).toBeDefined()
  })

  it('PUT /reorder с циклом возвращает 400', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin' })

    const parent = await prisma.category.create({
      data: { name: 'Parent', slug: 'parent', sortOrder: 1 },
    })

    const child = await prisma.category.create({
      data: {
        name: 'Child',
        slug: 'child',
        parentId: parent.id,
        sortOrder: 1,
      },
    })

    // Try to make parent a child of child (cycle)
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/categories/reorder',
      headers: authHeader(app, admin.id, 'super_admin'),
      payload: {
        items: [
          {
            id: parent.id,
            parentId: child.id,
            sortOrder: 1,
          },
        ],
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/cycle/i)
  })

  it('PUT /reorder успешно переупорядочивает категории', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin' })

    const cat1 = await prisma.category.create({
      data: { name: 'Cat 1', slug: 'cat-1', sortOrder: 1 },
    })

    const cat2 = await prisma.category.create({
      data: { name: 'Cat 2', slug: 'cat-2', sortOrder: 2 },
    })

    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/categories/reorder',
      headers: authHeader(app, admin.id, 'super_admin'),
      payload: {
        items: [
          { id: cat1.id, parentId: null, sortOrder: 10 },
          { id: cat2.id, parentId: null, sortOrder: 5 },
        ],
      },
    })

    expect(res.statusCode).toBe(200)

    const updated1 = await prisma.category.findUnique({ where: { id: cat1.id } })
    const updated2 = await prisma.category.findUnique({ where: { id: cat2.id } })

    expect(updated1?.sortOrder).toBe(10)
    expect(updated2?.sortOrder).toBe(5)
  })

  it('POST / создаёт категорию с валидацией slug', async () => {
    const admin = await createUser({ name: 'Admin' })

    // Valid slug
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/admin/categories',
      headers: authHeader(app, admin.id, 'super_admin'),
      payload: {
        name: 'Valid',
        slug: 'valid-slug-123',
      },
    })

    expect(res1.statusCode).toBe(201)

    // Invalid slug (uppercase)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/admin/categories',
      headers: authHeader(app, admin.id, 'super_admin'),
      payload: {
        name: 'Invalid',
        slug: 'Invalid-Slug',
      },
    })

    expect(res2.statusCode).toBe(400)
    expect(res2.json().error).toMatch(/slug/i)
  })

  it('DELETE /:id мягко удаляет категорию (isActive=false)', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin' })

    const cat = await prisma.category.create({
      data: { name: 'To Delete', slug: 'to-delete', isActive: true },
    })

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/categories/${cat.id}`,
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)

    const updated = await prisma.category.findUnique({ where: { id: cat.id } })
    expect(updated?.isActive).toBe(false)
  })
})
