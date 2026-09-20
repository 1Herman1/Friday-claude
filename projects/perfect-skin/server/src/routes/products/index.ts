import type { FastifyInstance } from 'fastify'
import listRoute from './list.js'
import facetsRoute from './facets.js'
import cardRoute from './card.js'

export default async function productsRoutes(app: FastifyInstance) {
  await listRoute(app)
  await facetsRoute(app)
  await cardRoute(app)
}
