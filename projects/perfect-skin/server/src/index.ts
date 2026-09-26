import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import prismaPlugin from './plugins/prisma.js'
import authenticatePlugin from './plugins/authenticate.js'
import { ApiError, errorResponse } from './lib/errors.js'
import { isProduction } from './lib/env.js'
import { registerCommonSchemas } from './schemas/common.js'
import productsRoutes from './routes/products/index.js'
import categoriesRoutes from './routes/categories/index.js'
import brandsRoutes from './routes/brands/index.js'
import linesRoutes from './routes/lines/index.js'
import cartRoutes from './routes/cart/index.js'
import promoRoutes from './routes/promo/index.js'
import deliveryRoutes from './routes/delivery/index.js'
import ordersRoutes from './routes/orders/index.js'
import authRoutes from './routes/auth/index.js'
import postsRoutes from './routes/posts/index.js'
import proRoutes from './routes/pro/index.js'
import adminRoutes from './routes/admin/index.js'
import exchange1cRoutes from './routes/exchange-1c.js'

const app = Fastify({
  logger: true,
  // Дефолт 100 символов режет длинные слаги товаров (до 120 по схеме).
  maxParamLength: 200,
})

// Прод без настоящих секретов не поднимается: дефолтные значения означают,
// что cookie корзины и JWT можно подделать офлайн.
if (isProduction) {
  const required = ['PS_COOKIE_SECRET', 'JWT_SECRET', 'PS_PROMO_HMAC_SECRET', 'PS_DATABASE_URL', 'PS_CORS_ORIGIN'] as const
  const missing = required.filter((k) => {
    const v = process.env[k]
    return !v || v.includes('dev-secret') || v === 'change-me'
  })
  if (missing.length) {
    app.log.fatal({ missing }, 'production start refused: secrets are missing or defaulted')
    process.exit(1)
  }
}

// Register common schemas
registerCommonSchemas(app)

// Register plugins
await app.register(prismaPlugin)
await app.register(cookie, {
  secret: process.env.PS_COOKIE_SECRET || 'dev-secret-change-in-production',
  hook: 'preHandler',
})
// Security headers; CSP off — это JSON-API, не HTML.
await app.register(helmet, { contentSecurityPolicy: false })
await app.register(cors, {
  origin: (process.env.PS_CORS_ORIGIN || 'http://localhost:3000').split(','),
  credentials: true,
})
await app.register(rateLimit, {
  max: 120,
  timeWindow: '1 minute',
})
// Multipart form data for file uploads
await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 МБ
    files: 1,
    fields: 12,
    fieldSize: 2048,
    parts: 14, // файл + 12 полей + граница = 14 частей
  },
})
await app.register(authenticatePlugin)

// Error handler
app.setErrorHandler((error, request, reply) => {
  if (error instanceof ApiError) {
    return reply.status(error.status).send(errorResponse(error))
  }

  // Fastify schema validation (querystring/params/body) — это 400, не 500.
  if ((error as { validation?: unknown }).validation) {
    return reply
      .status(400)
      .send(errorResponse(new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')))
  }

  // @fastify/rate-limit кидает FastifyError со statusCode 429 — без этой
  // ветки лимиты по всему API отдавались как 500.
  const statusCode = (error as { statusCode?: number }).statusCode
  if (statusCode === 429) {
    return reply
      .status(429)
      .send(errorResponse(new ApiError(429, 'RATE_LIMITED', 'Слишком много запросов. Попробуйте позже')))
  }

  app.log.error({ error, requestId: request.id })
  reply.status(500).send(
    errorResponse(
      new ApiError(500, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера')
    )
  )
})

// Health check
app.get('/api/v1/health', async (request, reply) => {
  return { ok: true, timestamp: new Date().toISOString() }
})

// Register exchange routes
await app.register(exchange1cRoutes)

// Register catalog routes
await app.register(productsRoutes, { prefix: '/api/v1/products' })
await app.register(categoriesRoutes, { prefix: '/api/v1/categories' })
await app.register(brandsRoutes, { prefix: '/api/v1/brands' })
await app.register(linesRoutes, { prefix: '/api/v1/lines' })

// Register checkout routes
await app.register(cartRoutes)
await app.register(deliveryRoutes)
await app.register(promoRoutes)
await app.register(ordersRoutes)
await app.register(authRoutes)
await app.register(proRoutes)

// Register posts routes
await app.register(postsRoutes, { prefix: '/api/v1' })

// Register admin routes
await app.register(adminRoutes)

// На сервере наружу смотрит только Nginx, поэтому по умолчанию слушаем
// петлю. 0.0.0.0 остаётся доступен через HOST — он нужен в контейнерах.
const PORT = Number(process.env.PORT) || 3000
const HOST = process.env.HOST || '127.0.0.1'

const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST })
    app.log.info(`Server is running on http://${HOST}:${PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()

export default app
