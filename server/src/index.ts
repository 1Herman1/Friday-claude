import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import prismaPlugin from './plugins/prisma'
import authenticatePlugin from './plugins/authenticate'
import authRoutes from './routes/auth/index'
import productRoutes from './routes/products'
import adminProductRoutes from './routes/products/admin-crud'
import favoritesRoutes from './routes/favorites/index'
import categoryRoutes from './routes/categories'
import brandRoutes from './routes/brands'
import cartRoutes from './routes/cart/index'
import orderRoutes from './routes/orders/index'
import orderAdminRoutes from './routes/orders/admin'
import subscriptionsRoutes from './routes/subscriptions/index'
import bonusesRoutes from './routes/bonuses/index'
import quizRoutes from './routes/quiz/index'
import deliveryRoutes from './routes/delivery/index'
import blogRoutes from './routes/blog/index'
import blogAdminRoutes from './routes/blog/admin'
import siteTextsRoutes from './routes/site-texts/index'
import siteTextsAdminRoutes from './routes/site-texts/admin'
import visitsRoutes from './routes/visits'
import addressRoutes from './routes/address/index'
import mediaRoutes from './routes/media'
import bannersRoutes from './routes/banners'
import adminDashboard from './routes/admin/dashboard'
import adminQuizRoutes from './routes/admin/quiz'
import adminUsers from './routes/admin/users'
import adminBrands from './routes/admin/brands'
import adminBanners from './routes/admin/banners'
import adminImport from './routes/admin/import'
import adminSync from './routes/admin/sync'
import adminDeliveryOptions from './routes/admin/delivery-options'
import adminCategoriesRoutes from './routes/categories/admin-crud'

/**
 * Собирает приложение, но НЕ слушает порт — чтобы тесты могли поднять его
 * через app.inject() без сети. Запуск сервера — в start() ниже.
 */
export async function buildApp(opts: { logger?: boolean } = {}) {
  // trustProxy: 1, а не true. Перед сервером ровно один прокси — nginx, и
  // доверять можно только адресу, который дописал он. С `true` Fastify брал
  // самый левый адрес из X-Forwarded-For, то есть тот, что прислал сам клиент,
  // и любой лимит по IP обходился одним заголовком.
  const app = Fastify({ logger: opts.logger ?? true, trustProxy: 1 })

  await app.register(cors, {
    origin: [process.env.CLIENT_URL!, process.env.ADMIN_URL!],
    credentials: true,
  })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET!,
  })

  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  })

  await app.register(prismaPlugin)
  await app.register(authenticatePlugin)
  await app.register(authRoutes, { prefix: '/api/auth' })

  app.get('/health', async () => ({ status: 'ok' }))

  await app.register(productRoutes, { prefix: '/api/products' })
  await app.register(adminProductRoutes, { prefix: '/api/admin/products' })
  await app.register(favoritesRoutes, { prefix: '/api/favorites' })
  await app.register(categoryRoutes, { prefix: '/api/categories' })
  await app.register(adminCategoriesRoutes, { prefix: '/api/admin/categories' })
  await app.register(brandRoutes, { prefix: '/api/brands' })
  await app.register(cartRoutes, { prefix: '/api/cart' })
  await app.register(orderRoutes, { prefix: '/api/orders' })
  await app.register(orderAdminRoutes, { prefix: '/api/admin/orders' })
  await app.register(subscriptionsRoutes, { prefix: '/api/subscriptions' })
  await app.register(bonusesRoutes, { prefix: '/api/bonuses' })
  await app.register(quizRoutes, { prefix: '/api/quiz' })
  await app.register(bannersRoutes, { prefix: '/api/banners' })
  await app.register(mediaRoutes, { prefix: '/api/media' })
  await app.register(adminDashboard, { prefix: '/api/admin/dashboard' })
  await app.register(adminUsers, { prefix: '/api/admin/users' })
  await app.register(adminBrands, { prefix: '/api/admin/brands' })
  await app.register(adminBanners, { prefix: '/api/admin/banners' })
  await app.register(adminDeliveryOptions, { prefix: '/api/admin/delivery-options' })
  await app.register(adminImport, { prefix: '/api/admin/import' })
  await app.register(adminSync, { prefix: '/api/admin/sync' })
  await app.register(adminQuizRoutes, { prefix: '/api/admin/quiz' })
  await app.register(addressRoutes, { prefix: '/api/address' })
  await app.register(deliveryRoutes, { prefix: '/api/delivery' })
  await app.register(blogRoutes, { prefix: '/api/blog' })
  await app.register(blogAdminRoutes, { prefix: '/api/admin/blog' })
  await app.register(siteTextsRoutes, { prefix: '/api/site-texts' })
  await app.register(siteTextsAdminRoutes, { prefix: '/api/admin/site-texts' })
  await app.register(visitsRoutes, { prefix: '/api/visits' })

  return app
}

async function start() {
  const app = await buildApp()
  const port = Number(process.env.PORT) || 3000
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`Server running on http://localhost:${port}`)
}

// Из тестов файл импортируется ради buildApp — сервер при этом подниматься не должен.
if (process.env.NODE_ENV !== 'test') {
  start().catch((err) => {
    console.error('Не удалось запустить сервер:', err)
    process.exit(1)
  })
}
