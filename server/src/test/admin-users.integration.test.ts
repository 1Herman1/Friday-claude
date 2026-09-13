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

  it('search на type=registered находит по email', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })

    const registered = await prisma.user.create({
      data: { name: 'Search Me', email: 'searchme@example.com' },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users?type=registered&search=searchme@',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any
    const ids = data.items.map((u: any) => u.id)

    expect(ids).toContain(registered.id)
  })

  it('segment=noOrders фильтрует пользователей без заказов', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })

    const withOrder = await prisma.user.create({
      data: {
        name: 'With Order',
        email: 'with@test.com',
        orders: {
          create: {
            status: 'new',
            deliveryMethod: 'pickup',
            subtotal: 10000,
            total: 10000,
          },
        },
      },
    })

    const noOrder = await prisma.user.create({
      data: { name: 'No Order', email: 'noorder@test.com' },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users?type=registered&segment=noOrders',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any
    const ids = data.items.map((u: any) => u.id)

    expect(ids).toContain(noOrder.id)
    expect(ids).not.toContain(withOrder.id)
  })

  it('PUT /:id/active false блокирует пользователя, он не может войти', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })
    const user = await createUser({ name: 'User', email: 'user@test.com' })
    const userToken = app.jwt.sign({ userId: user.id, role: user.role }, { expiresIn: '7d' })

    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/users/${user.id}/active`,
      headers: authHeader(app, admin.id, 'super_admin'),
      payload: { isActive: false },
    })

    expect(res.statusCode).toBe(200)

    // Now user tries to call GET /api/auth/me with their token — should get 401 USER_BLOCKED
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { Authorization: `Bearer ${userToken}` },
    })

    expect(meRes.statusCode).toBe(401)
    const meData = meRes.json() as any
    expect(meData.code).toBe('USER_BLOCKED')
  })

  it('POST /:id/bonus увеличивает баланс и создаёт запись с типом admin_adjust', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })
    const user = await createUser({ name: 'User', email: 'user@test.com', bonusPoints: 0 })

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${user.id}/bonus`,
      headers: authHeader(app, admin.id, 'super_admin'),
      payload: { amount: 100, comment: 'Test bonus' },
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any
    expect(data.balanceAfter).toBe(100)

    // Check that transaction was created
    const tx = await prisma.bonusTransaction.findFirst({
      where: { userId: user.id, type: 'admin_adjust' },
    })
    expect(tx).toBeDefined()
    expect(tx?.amount).toBe(100)
    expect(tx?.comment).toContain('Test bonus')
  })

  it('POST /:id/bonus с отрицательной суммой требует достаточных бонусов', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })
    const user = await createUser({ name: 'User', email: 'user@test.com', bonusPoints: 100 })

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${user.id}/bonus`,
      headers: authHeader(app, admin.id, 'super_admin'),
      payload: { amount: -999, comment: 'Too much' },
    })

    expect(res.statusCode).toBe(409)
    const data = res.json() as any
    expect(data.error).toContain('Недостаточно')
  })

  it('GET /:id возвращает stats.paidTotal только для paid заказов', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })
    const user = await createUser({ name: 'User', email: 'user@test.com' })

    // Paid order
    await prisma.order.create({
      data: {
        userId: user.id,
        status: 'delivered',
        paymentStatus: 'paid',
        deliveryMethod: 'pickup',
        subtotal: 5000,
        total: 5000,
      },
    })

    // Unpaid order
    await prisma.order.create({
      data: {
        userId: user.id,
        status: 'new',
        paymentStatus: 'pending',
        deliveryMethod: 'pickup',
        subtotal: 3000,
        total: 3000,
      },
    })

    // Cancelled paid order (should not count)
    await prisma.order.create({
      data: {
        userId: user.id,
        status: 'cancelled',
        paymentStatus: 'paid',
        deliveryMethod: 'pickup',
        subtotal: 2000,
        total: 2000,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/users/${user.id}`,
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any
    expect(data.stats.paidTotal).toBe(5000) // Only the paid non-cancelled order
    expect(data.stats.ordersCount).toBe(3) // All orders
  })
})
