import type { FastifyInstance } from 'fastify'
import listRoute from './list.js'
import detailRoute from './detail.js'

export default async function brandsRoutes(app: FastifyInstance) {
  await listRoute(app)
  await detailRoute(app)
}
