import type { FastifyInstance } from 'fastify'
import fastifyPlugin from 'fastify-plugin'
import { checkRole } from '../../middleware/check-role.js'
import { ordersRoutes } from './orders.js'
import { productsRoutes } from './products.js'
import { promoRoutes } from './promo.js'
import { postsRoutes } from './posts.js'
import { dashboardRoutes } from './dashboard.js'
import { syncRoutes } from './sync.js'
import { proRequestsRoutes } from './pro-requests.js'

export default fastifyPlugin(async (app: FastifyInstance) => {
  // Dashboard routes: all staff roles
  const dashboardPreHandlers = [app.authenticate, checkRole(['super_admin', 'orders_manager', 'products_manager', 'content_manager'])]
  await app.register(
    async (instance) => dashboardRoutes(instance, dashboardPreHandlers),
    {
      prefix: '/api/v1/admin',
    }
  )

  // Orders routes: super_admin or orders_manager
  const ordersPreHandlers = [app.authenticate, checkRole(['super_admin', 'orders_manager'])]
  await app.register(
    async (instance) => ordersRoutes(instance, ordersPreHandlers),
    {
      prefix: '/api/v1/admin',
    }
  )

  // Products routes: super_admin or products_manager
  const productsPreHandlers = [app.authenticate, checkRole(['super_admin', 'products_manager'])]
  await app.register(
    async (instance) => productsRoutes(instance, productsPreHandlers),
    {
      prefix: '/api/v1/admin',
    }
  )

  // Promo routes: super_admin or orders_manager
  const promoPreHandlers = [app.authenticate, checkRole(['super_admin', 'orders_manager'])]
  await app.register(
    async (instance) => promoRoutes(instance, promoPreHandlers),
    {
      prefix: '/api/v1/admin',
    }
  )

  // Posts routes: super_admin or content_manager
  const postsPreHandlers = [app.authenticate, checkRole(['super_admin', 'content_manager'])]
  await app.register(
    async (instance) => postsRoutes(instance, postsPreHandlers),
    {
      prefix: '/api/v1/admin',
    }
  )

  // Sync log routes: super_admin only
  const syncPreHandlers = [app.authenticate, checkRole(['super_admin'])]
  await app.register(
    async (instance) => syncRoutes(instance, syncPreHandlers),
    {
      prefix: '/api/v1/admin',
    }
  )

  // Pro requests routes: super_admin or orders_manager
  const proRequestsPreHandlers = [app.authenticate, checkRole(['super_admin', 'orders_manager'])]
  await app.register(
    async (instance) => proRequestsRoutes(instance, proRequestsPreHandlers),
    {
      prefix: '/api/v1/admin',
    }
  )
})
