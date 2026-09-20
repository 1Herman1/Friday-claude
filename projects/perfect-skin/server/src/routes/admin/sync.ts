import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '../../lib/db.js'

/**
 * Журнал синхронизации с 1С: последние 50 записей.
 */

export async function syncRoutes(app: FastifyInstance, preHandlers: any[]) {
  // GET /api/v1/admin/sync-log
  app.get<{ Reply: any }>(
    '/sync-log',
    {
      preHandler: preHandlers,
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['items'],
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['id', 'direction', 'status', 'itemsCount', 'createdAt'],
                  properties: {
                    id: { type: 'string' },
                    direction: { type: 'string', enum: ['import', 'export', 'auth'] },
                    status: { type: 'string', enum: ['success', 'failed', 'pending'] },
                    itemsCount: { type: 'integer' },
                    errorText: { type: ['string', 'null'] },
                    createdAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const logs = await db.syncLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      reply.code(200)
      return { items: logs }
    }
  )
}
