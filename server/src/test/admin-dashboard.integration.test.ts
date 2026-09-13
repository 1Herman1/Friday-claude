import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createUser, authHeader } from './factories'

describe.skipIf(!hasTestDb)('Admin dashboard (интеграционные)', () => {
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

  it('period=week возвращает series с дневными бакетами', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })

    // Create orders on different days this week
    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    await prisma.order.create({
      data: {
        userId: admin.id,
        status: 'new',
        deliveryMethod: 'pickup',
        subtotal: 10000,
        total: 10000,
        paymentStatus: 'paid',
        createdAt: today,
      },
    })

    await prisma.order.create({
      data: {
        userId: admin.id,
        status: 'new',
        deliveryMethod: 'pickup',
        subtotal: 5000,
        total: 5000,
        paymentStatus: 'paid',
        createdAt: yesterday,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard?period=week',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any

    expect(data.period).toBeDefined()
    expect(data.period.from).toBeDefined()
    expect(data.period.to).toBeDefined()
    expect(data.period.orders).toBeGreaterThanOrEqual(1)
    expect(data.period.revenue).toBeGreaterThanOrEqual(5000)

    expect(data.series).toBeDefined()
    expect(Array.isArray(data.series)).toBe(true)
    expect(data.series.length).toBeGreaterThanOrEqual(1)

    const seriesItem = data.series[0]
    expect(seriesItem.date).toBeDefined()
    expect(typeof seriesItem.orders).toBe('number')
    expect(typeof seriesItem.revenue).toBe('number')
    expect(typeof seriesItem.visits).toBe('number')
  })

  it('period=month возвращает series с дневными бакетами', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard?period=month',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any

    expect(data.period).toBeDefined()
    expect(data.series).toBeDefined()
    expect(Array.isArray(data.series)).toBe(true)
  })

  it('period=year возвращает series с месячными бакетами', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })

    // Create orders in different months
    const jan = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 15))
    const jun = new Date(Date.UTC(new Date().getUTCFullYear(), 5, 15))

    await prisma.order.create({
      data: {
        userId: admin.id,
        status: 'new',
        deliveryMethod: 'pickup',
        subtotal: 10000,
        total: 10000,
        paymentStatus: 'paid',
        createdAt: jan,
      },
    })

    await prisma.order.create({
      data: {
        userId: admin.id,
        status: 'new',
        deliveryMethod: 'pickup',
        subtotal: 20000,
        total: 20000,
        paymentStatus: 'paid',
        createdAt: jun,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard?period=year',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any

    expect(data.period).toBeDefined()
    expect(data.period.orders).toBeGreaterThanOrEqual(1)
    expect(data.series).toBeDefined()
    expect(Array.isArray(data.series)).toBe(true)
    // Year has ~12 month buckets
    expect(data.series.length).toBeGreaterThanOrEqual(1)
  })

  it('period=today возвращает series с одним днём', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard?period=today',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any

    expect(data.period).toBeDefined()
    expect(data.series).toBeDefined()
    expect(Array.isArray(data.series)).toBe(true)
    expect(data.series.length).toBeGreaterThanOrEqual(1)
  })

  it('period.visits из SiteVisit суммируется корректно', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })

    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

    await prisma.siteVisit.create({
      data: {
        day: today,
        count: 42,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard?period=month',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any

    expect(data.period.visits).toBeGreaterThanOrEqual(0)
    const todayVisits = data.series.find((s: any) => s.date === today.toISOString().split('T')[0])
    if (todayVisits) {
      expect(todayVisits.visits).toBe(42)
    }
  })

  it('дефолтный period = month', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any

    expect(data.period).toBeDefined()
    expect(data.series).toBeDefined()
    expect(data.filters.period).toBe('month')
    expect(data.filters.userType).toBe('all')
  })

  it('сохраняет обратную совместимость: старые поля (ordersToday, revenueMonth и т.д.)', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any

    expect(data.ordersToday).toBeDefined()
    expect(data.ordersMonth).toBeDefined()
    expect(data.revenueToday).toBeDefined()
    expect(data.revenueMonth).toBeDefined()
    expect(data.totalUsers).toBeDefined()
    expect(data.newUsersToday).toBeDefined()
    expect(data.totalProducts).toBeDefined()
    expect(data.recentOrders).toBeDefined()
  })

  it('userType=guest фильтрует только заказы гостей', async () => {
    const prisma = getTestPrisma()
    const registeredUser = await createUser({ name: 'Registered', email: 'reg@test.com' })

    // Создаём гостевого пользователя без email/phone/password
    const guestUser = await prisma.user.create({
      data: {
        name: 'Гость',
      },
    })

    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

    // Заказ от зарегистрированного пользователя
    await prisma.order.create({
      data: {
        userId: registeredUser.id,
        status: 'new',
        deliveryMethod: 'pickup',
        subtotal: 10000,
        total: 10000,
        paymentStatus: 'paid',
        guestCheckout: false,
        createdAt: today,
      },
    })

    // Заказ от гостя
    await prisma.order.create({
      data: {
        userId: guestUser.id,
        status: 'new',
        deliveryMethod: 'pickup',
        subtotal: 5000,
        total: 5000,
        paymentStatus: 'paid',
        guestCheckout: true,
        createdAt: today,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard?userType=guest',
      headers: authHeader(app, registeredUser.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any

    expect(data.filters.userType).toBe('guest')
    expect(data.ordersToday).toBe(1)
    expect(data.revenueToday).toBe(5000)
  })

  it('userType=registered фильтрует только заказы пользователей', async () => {
    const prisma = getTestPrisma()
    const registeredUser = await createUser({ name: 'Registered', email: 'reg@test.com' })

    const guestUser = await prisma.user.create({
      data: {
        name: 'Гость',
      },
    })

    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

    await prisma.order.create({
      data: {
        userId: registeredUser.id,
        status: 'new',
        deliveryMethod: 'pickup',
        subtotal: 10000,
        total: 10000,
        paymentStatus: 'paid',
        guestCheckout: false,
        createdAt: today,
      },
    })

    await prisma.order.create({
      data: {
        userId: guestUser.id,
        status: 'new',
        deliveryMethod: 'pickup',
        subtotal: 5000,
        total: 5000,
        paymentStatus: 'paid',
        guestCheckout: true,
        createdAt: today,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard?userType=registered',
      headers: authHeader(app, registeredUser.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any

    expect(data.filters.userType).toBe('registered')
    expect(data.ordersToday).toBe(1)
    expect(data.revenueToday).toBe(10000)
  })

  it('ordersTodayBreakdown.paidCash.count === 1 после создания оплаченного заказа наличными', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })

    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

    await prisma.order.create({
      data: {
        userId: admin.id,
        status: 'new',
        deliveryMethod: 'pickup',
        subtotal: 5000,
        total: 5000,
        paymentMethod: 'cash_on_delivery',
        paymentStatus: 'paid',
        createdAt: today,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any

    expect(data.ordersTodayBreakdown).toBeDefined()
    expect(data.ordersTodayBreakdown.paidCash.count).toBe(1)
    expect(data.ordersTodayBreakdown.paidCash.sum).toBe(5000)
  })

  it('period.revenue исключает заказы со статусом pending', async () => {
    const prisma = getTestPrisma()
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com' })

    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

    // Оплаченный заказ
    await prisma.order.create({
      data: {
        userId: admin.id,
        status: 'new',
        deliveryMethod: 'pickup',
        subtotal: 10000,
        total: 10000,
        paymentStatus: 'paid',
        createdAt: today,
      },
    })

    // Неоплаченный заказ
    await prisma.order.create({
      data: {
        userId: admin.id,
        status: 'new',
        deliveryMethod: 'pickup',
        subtotal: 5000,
        total: 5000,
        paymentStatus: 'pending',
        createdAt: today,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard?period=month',
      headers: authHeader(app, admin.id, 'super_admin'),
    })

    expect(res.statusCode).toBe(200)
    const data = res.json() as any

    // Оба заказа в period.orders (cancelled исключены, но pending не)
    expect(data.period.orders).toBe(2)
    // Но revenue только из оплаченных
    expect(data.period.revenue).toBe(10000)
  })
})
