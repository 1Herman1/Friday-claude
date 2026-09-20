import { FastifyPluginAsync } from 'fastify'
import { checkRole } from '../../middleware/check-role'
import { getQuizCoverage } from '../../services/quiz.service'

const adminQuizRoute: FastifyPluginAsync = async (app) => {
  const guard = { preHandler: [app.authenticate, checkRole(['super_admin', 'products_manager'])] }

  app.get('/coverage', guard, async (_req, reply) => {
    const coverage = await app.prisma.$transaction(async (tx) => {
      return getQuizCoverage(tx)
    })
    return reply.send(coverage)
  })
}

export default adminQuizRoute
