import { FastifyInstance } from 'fastify'
import list from './list'
import single from './single'
import popular from './popular'

export default async function productRoutes(app: FastifyInstance) {
  await app.register(list)
  await app.register(single)
  await app.register(popular)
}
