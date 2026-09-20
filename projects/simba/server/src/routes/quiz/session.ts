import { FastifyPluginAsync } from 'fastify'
import { getQuizSession } from '../../services/quiz.service'

const sessionRoute: FastifyPluginAsync = async (app) => {
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const result = await app.prisma.$transaction(async (tx) => {
      return getQuizSession(tx, id)
    })

    if (!result) {
      return reply.status(404).send({ error: 'Session not found' })
    }

    return reply.send(result)
  })
}

export default sessionRoute
