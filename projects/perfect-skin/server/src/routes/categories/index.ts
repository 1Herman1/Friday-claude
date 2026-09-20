import type { FastifyInstance } from 'fastify'
import treeRoute from './tree.js'
import detailRoute from './detail.js'

export default async function categoriesRoutes(app: FastifyInstance) {
  await treeRoute(app)
  await detailRoute(app)
}
