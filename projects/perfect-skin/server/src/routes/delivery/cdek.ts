import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import fastifyPlugin from 'fastify-plugin'
import { ApiError } from '../../lib/errors.js'
import { deliveryQuote, filterPoints } from '../../services/cdek/quote.service.js'
import type { CdekPoint } from '../../services/cdek/client.js'
import { getCdek, getCdekSync } from '../../services/cdek/registry.js'
import { cdekWebhookBodySchema } from '../../services/cdek/schemas.js'

const RATE_LIMIT = { max: 60, timeWindow: '1 minute' }
const WEBHOOK_RATE_LIMIT = { max: 120, timeWindow: '1 minute' }
const WEBHOOK_BODY_LIMIT = 65_536
const CACHE_CONTROL = 'public, max-age=300'

function tokenMatches(token: string, secret: string | null): boolean {
  if (secret === null) return false
  const digest = (value: string): Buffer => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(token), digest(secret))
}

interface CitiesQuery {
  q: string
}

interface PointsQuery {
  cityCode: number
  q?: string
  type?: 'ALL' | 'PVZ' | 'POSTAMAT'
  limit?: number
  offset?: number
}

function toPointView(point: CdekPoint): Omit<CdekPoint, 'cityCode' | 'city'> {
  return {
    code: point.code,
    type: point.type,
    name: point.name,
    address: point.address,
    workTime: point.workTime,
    metro: point.metro,
    lat: point.lat,
    lon: point.lon,
  }
}

export default fastifyPlugin(async (app: FastifyInstance) => {
  app.get<{ Querystring: CitiesQuery }>(
    '/api/v1/delivery/cities',
    {
      config: { rateLimit: RATE_LIMIT },
      schema: {
        querystring: {
          type: 'object',
          required: ['q'],
          properties: { q: { type: 'string', pattern: '^[\\p{L}\\d .()-]{2,64}$' } },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['items'],
            properties: { items: { type: 'array', maxItems: 10, items: { $ref: 'ps.cdekCity#' } } },
          },
        },
      },
    },
    async (request, reply) => {
      const items = await deliveryQuote(app.log).cities(request.query.q)
      reply.header('Cache-Control', CACHE_CONTROL)
      return { items }
    }
  )

  app.get<{ Querystring: PointsQuery }>(
    '/api/v1/delivery/points',
    {
      config: { rateLimit: RATE_LIMIT },
      schema: {
        querystring: {
          type: 'object',
          required: ['cityCode'],
          properties: {
            cityCode: { type: 'integer', minimum: 1, maximum: 9999999 },
            q: { type: 'string', maxLength: 64 },
            type: { type: 'string', enum: ['ALL', 'PVZ', 'POSTAMAT'] },
            limit: { type: 'integer', minimum: 1, maximum: 50 },
            offset: { type: 'integer', minimum: 0, maximum: 5000 },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['items', 'total'],
            properties: {
              items: { type: 'array', items: { $ref: 'ps.cdekPoint#' } },
              total: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { cityCode, q = '', type = 'ALL', limit = 30, offset = 0 } = request.query
      const matched = filterPoints(await deliveryQuote(app.log).points(cityCode), { q, type })
      reply.header('Cache-Control', CACHE_CONTROL)
      return {
        items: matched.slice(offset, offset + limit).map(toPointView),
        total: matched.length,
      }
    }
  )
  app.post<{ Params: { token: string } }>(
    '/api/v1/delivery/cdek/webhook/:token',
    {
      bodyLimit: WEBHOOK_BODY_LIMIT,
      config: { rateLimit: WEBHOOK_RATE_LIMIT },
    },
    async (request) => {
      const services = getCdek()
      const sync = getCdekSync()
      if (services === null || sync === null || !tokenMatches(request.params.token, services.config.webhookSecret)) {
        throw new ApiError(404, 'NOT_FOUND', 'Не найдено')
      }
      const body = cdekWebhookBodySchema.safeParse(request.body)
      if (!body.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')

      try {
        await sync.handleWebhook(body.data)
      } catch (error) {
        app.log.warn({ reason: error instanceof Error ? error.name : 'unknown' }, 'СДЭК вебхук: обновление не прошло, подберёт сверка')
      }
      return { ok: true }
    }
  )
})
