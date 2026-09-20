import { FastifyInstance } from 'fastify'
import tree from './tree'
import single from './single'
import adminCrud from './admin-crud'

export default async function categoryRoutes(app: FastifyInstance) {
  await app.register(tree)
  await app.register(single)
  await app.register(adminCrud)
}
