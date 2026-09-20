import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { adminDashboardService } from '../../services/admin-dashboard.service.js'

export async function dashboardRoutes(app: FastifyInstance, preHandlers: any[]) {
  // GET /api/v1/admin/dashboard
  app.get<{ Reply: any }>(
    '/dashboard',
    {
      preHandler: preHandlers,
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['ordersByStatus', 'revenue', 'recentOrders', 'lowStock', 'salesByDay'],
            properties: {
              ordersByStatus: {
                type: 'object',
                additionalProperties: false,
                required: ['new', 'confirmed', 'packed', 'in_transit', 'delivered', 'cancelled'],
                properties: {
                  new: { type: 'integer' },
                  confirmed: { type: 'integer' },
                  packed: { type: 'integer' },
                  in_transit: { type: 'integer' },
                  delivered: { type: 'integer' },
                  cancelled: { type: 'integer' },
                },
              },
              revenue: {
                type: 'object',
                additionalProperties: false,
                required: ['today', 'week', 'month'],
                properties: {
                  today: { type: 'integer' },
                  week: { type: 'integer' },
                  month: { type: 'integer' },
                },
              },
              recentOrders: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['id', 'number', 'createdAt', 'recipientName', 'total', 'status', 'paymentStatus'],
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    number: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    recipientName: { type: 'string' },
                    total: { type: 'integer' },
                    status: { type: 'string' },
                    paymentStatus: { type: 'string' },
                  },
                },
              },
              lowStock: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['variantId', 'productName', 'volumeLabel', 'stock'],
                  properties: {
                    variantId: { type: 'string', format: 'uuid' },
                    productName: { type: 'string' },
                    volumeLabel: { type: 'string' },
                    stock: { type: 'integer' },
                  },
                },
              },
              salesByDay: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['date', 'ordersCount', 'revenue'],
                  properties: {
                    date: { type: 'string', format: 'date' },
                    ordersCount: { type: 'integer' },
                    revenue: { type: 'integer' },
                  },
                },
              },
            },
          },
          401: { type: 'object' },
          403: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = await adminDashboardService.getDashboardData()
      reply.code(200)
      return data
    }
  )
}
