import { FastifyPluginAsync } from 'fastify'
import matchRoute from './match'
import sessionRoute from './session'
import claimRoute from './claim'

const quizRoutes: FastifyPluginAsync = async (app) => {
  await app.register(matchRoute)
  await app.register(sessionRoute)
  await app.register(claimRoute)
}

export default quizRoutes
