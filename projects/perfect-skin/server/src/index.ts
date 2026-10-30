import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import prismaPlugin from './plugins/prisma.js'
import authenticatePlugin from './plugins/authenticate.js'
import { ApiError, errorResponse } from './lib/errors.js'
import { isDevelopment, isProduction } from './lib/env.js'
import { maskSensitiveUrl } from './lib/log-mask.js'
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
import videoReviewsRoutes from './routes/video-reviews.js'
import videoReviewMediaRoutes from './routes/video-review-media.js'
import proRoutes from './routes/pro/index.js'
import consultationsRoutes from './routes/consultations.js'
import careRequestsRoutes from './routes/care-requests.js'
import { reviewRoutes } from './routes/review.js'
import adminRoutes from './routes/admin/index.js'
import exchange1cRoutes from './routes/exchange-1c.js'
import seoHtmlRoutes from './routes/seo-html.js'
import seoFilesRoutes from './routes/seo-files.js'
import { createTelegramNotifier, TelegramNotifier } from './services/telegram/notifier.js'
import { createProTelegramBot, createOrdersTelegramBot } from './services/telegram/bot.js'
import { CdekConfigError, parseCdekConfig } from './services/cdek/config.js'
import { initCdek } from './services/cdek/registry.js'
import { CdekUnavailableError } from './services/cdek/http.js'

declare module 'fastify' {
  interface FastifyInstance {
    telegram: TelegramNotifier
  }
}

const app = Fastify({
  // За Nginx все запросы приходят с 127.0.0.1: без этого лимиты по IP общие на весь сайт.
  // 'loopback' доверяет X-Forwarded-For только от петли, а Nginx его перезаписывает.
  trustProxy: 'loopback',
  logger: {
    // Маскируем токены просмотра заявок в логах
    serializers: {
      req: (request: any) => {
        const url = maskSensitiveUrl(request.url || '')
        return {
          id: request.id,
          method: request.method,
          url,
          remoteAddress: request.ip,
          // Только тип браузера: в заголовках cookie сессии и Authorization обмена с 1С
          userAgent: request.headers?.['user-agent'],
        }
      },
    },
  },
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

  // СДЭК недоступен: это не сбой нашего кода, а повтор через минуту.
  if (error instanceof CdekUnavailableError) {
    return reply
      .status(503)
      .send(errorResponse(new ApiError(503, 'CDEK_UNAVAILABLE', 'СДЭК временно недоступен, повторите позже')))
  }

  // Файл больше лимита multipart: это 413 от клиента, а не сбой сервера.
  if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
    return reply
      .status(413)
      .send(errorResponse(new ApiError(413, 'FILE_TOO_LARGE', 'Файл слишком большой')))
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

// Инициализируем Telegram-нотификатор ДО регистрации маршрутов
const notifier = createTelegramNotifier(app.prisma, app)
app.decorate('telegram', notifier)

// Кривая конфигурация СДЭК при включённой интеграции — понятная причина в логе, а не падение на импорте
try {
  initCdek(parseCdekConfig(process.env), app.log)
} catch (error) {
  if (!(error instanceof CdekConfigError)) throw error
  app.log.fatal({ reason: error.message }, 'СДЭК: неверная конфигурация, сервер не запущен')
  process.exit(1)
}

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
await app.register(consultationsRoutes)
await app.register(careRequestsRoutes)

// Register posts routes
await app.register(postsRoutes, { prefix: '/api/v1' })
await app.register(videoReviewsRoutes, { prefix: '/api/v1' })
await app.register(videoReviewMediaRoutes, { streamLocally: isDevelopment })

// Register review routes (for viewing applications via one-time links)
await app.register(async (instance) => reviewRoutes(instance), { prefix: '/api/v1' })

// Register admin routes
await app.register(adminRoutes)

// SEO после всех API-роутов: HTML для роботов и robots/sitemap не должны перехватывать /api/*
await app.register(seoFilesRoutes)
await app.register(seoHtmlRoutes)

// Инициализируем Telegram-боты и запускаем поллеры
const proBot = createProTelegramBot(app.prisma, app, notifier)
const ordersBot = createOrdersTelegramBot(app.prisma, app, notifier)

if (proBot) {
  proBot.start()
  app.log.info('Telegram pro bot started')
} else {
  app.log.warn('PS_TG_BOT_TOKEN not set, Telegram pro bot disabled')
}

if (ordersBot) {
  ordersBot.start()
  app.log.info('Telegram orders bot started')
} else {
  app.log.warn('PS_TG_ORDERS_BOT_TOKEN not set, Telegram orders bot disabled')
}

// Останавливаем боты при закрытии сервера
app.addHook('onClose', async () => {
  if (proBot) proBot.stop()
  if (ordersBot) ordersBot.stop()
  app.log.info('Telegram bots stopped')
})

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
