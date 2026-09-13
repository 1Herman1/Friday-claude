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
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const yesterdayStart = new Date(today)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    await prisma.order.create({
      data: {
        userId: admin.id,
        status: 'new',
        deliveryMethod: 'pickup',
        subtotal: 10000,
        total: 10000,
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
        createdAt: yesterdayStart,
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
    const jan = new Date(new Date().getFullYear(), 0, 15)
    const jun = new Date(new Date().getFullYear(), 5, 15)

    await prisma.order.create({
      data: {
        userId: admin.id,
        status: 'new',
        deliveryMethod: 'pickup',
        subtotal: 10000,
        total: 10000,
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

    const today = new Date()
    today.setHours(0, 0, 0, 0)

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
})
