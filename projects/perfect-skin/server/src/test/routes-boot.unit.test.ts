import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import multipart from '@fastify/multipart'
import { registerCommonSchemas } from '../schemas/common.js'
import adminRoutes from '../routes/admin/index.js'

// Дубль маршрута роняет сервер только при старте — ловим это без базы.
describe('admin routes', () => {
  it('register without duplicate or schema errors', async () => {
    const app = Fastify()
    registerCommonSchemas(app)
    await app.register(multipart)
    app.decorate('authenticate', async () => {})
    app.decorate('prisma', {} as never)
    app.decorate('telegram', {} as never)
    await app.register(adminRoutes)
    await expect(app.ready()).resolves.toBeDefined()
    await app.close()
  })
})

import deliveryRoutes from '../routes/delivery/index.js'

describe('delivery routes', () => {
  it('register cities, points and methods without duplicate or schema errors', async () => {
    const app = Fastify()
    registerCommonSchemas(app)
    app.decorate('authenticateOptional', async () => {})
    await app.register(deliveryRoutes)
    await expect(app.ready()).resolves.toBeDefined()
    await app.close()
  })
})
