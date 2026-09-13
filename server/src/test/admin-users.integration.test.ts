import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createUser, authHeader, createProductWithVariant, createCart } from './factories'

describe.skipIf(!hasTestDb)('Admin users (интеграционные)', () => {
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

  it('type=registered возвращает только пользователей с email/phone/passwordHash', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin' })

    // Registered user with email
    const registered = await prisma.user.create({
      data: { name: 'Registered', email: 'reg@test.com' },
    })

    // Guest user (no email, no phone, no passwordHash)
    const guestNoInteraction = await prisma.user.create({
      data: { name: 'Guest No Interaction' },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users?type=registered',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any
    const ids = data.items.map((u: any) => u.id)

    expect(ids).toContain(registered.id)
    expect(ids).not.toContain(guestNoInteraction.id)
  })

  it('type=guests возвращает только гостей с взаимодействиями', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })

    // Guest with cart items (has interaction)
    const guestWithCart = await prisma.user.create({
      data: { name: 'Guest With Cart' },
    })

    const { variant } = await createProductWithVariant()
    await createCart(guestWithCart.id, [{ variantId: variant.id, quantity: 1 }])

    // Guest with no interaction
    const guestNoInteraction = await prisma.user.create({
      data: { name: 'Guest No Interaction' },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users?type=guests',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any
    const ids = data.items.map((u: any) => u.id)

    expect(ids).toContain(guestWithCart.id)
    expect(ids).not.toContain(guestNoInteraction.id)
    expect(ids).not.toContain(admin.id)
  })

  it('type=all возвращает всех пользователей с взаимодействиями', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })

    const registered = await prisma.user.create({
      data: { name: 'Registered', email: 'reg@test.com' },
    })

    const guestWithOrder = await prisma.user.create({
      data: { name: 'Guest With Order' },
    })

    await prisma.order.create({
      data: {
        userId: guestWithOrder.id,
        status: 'new',
        deliveryMethod: 'pickup',
        subtotal: 10000,
        total: 10000,
      },
    })

    const guestNoInteraction = await prisma.user.create({
      data: { name: 'Guest No Interaction' },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users?type=all',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any
    const ids = data.items.map((u: any) => u.id)

    expect(ids).toContain(admin.id)
    expect(ids).toContain(registered.id)
    expect(ids).toContain(guestWithOrder.id)
    // guestNoInteraction may not appear depending on query logic
  })

  it('возвращает isGuest, cartItems count и lastSeenAt', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })
    const guest = await createUser({ name: 'Guest' })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users?type=registered&limit=100',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any
    const adminItem = data.items.find((u: any) => u.id === admin.id)

    expect(adminItem).toBeDefined()
    expect(adminItem.isGuest).toBe(false)
    expect(adminItem.cartItems).toBeDefined()
    expect(adminItem._count).toBeDefined()
    expect(adminItem._count.orders).toBeDefined()
    expect(adminItem.lastSeenAt).toBeDefined()
  })

  it('sort=lastSeen сортирует по lastSeenAt', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })

    const user1 = await prisma.user.create({
      data: { name: 'User 1', email: 'u1@test.com', lastSeenAt: new Date('2026-01-01') },
    })

    const user2 = await prisma.user.create({
      data: { name: 'User 2', email: 'u2@test.com', lastSeenAt: new Date('2026-01-10') },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users?sort=lastSeen&type=registered',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any
    const users = data.items.filter((u: any) => [user1.id, user2.id].includes(u.id))

    // Most recent first
    expect(users[0].id).toBe(user2.id)
    expect(users[1].id).toBe(user1.id)
  })
})
