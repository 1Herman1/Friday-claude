import type { FastifyInstance } from 'fastify'
import fastifyPlugin from 'fastify-plugin'
import { deliveryQuote, filterPoints } from '../../services/cdek/quote.service.js'
import type { CdekPoint } from '../../services/cdek/client.js'

const RATE_LIMIT = { max: 60, timeWindow: '1 minute' }
const CACHE_CONTROL = 'public, max-age=300'

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
})
