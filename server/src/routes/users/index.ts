import { FastifyPluginAsync } from 'fastify'
import profile from './profile'

const usersRoutes: FastifyPluginAsync = async (app) => {
  app.register(profile)
}

export default usersRoutes
