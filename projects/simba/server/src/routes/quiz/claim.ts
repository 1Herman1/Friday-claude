import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { claimQuizBonus } from '../../services/quiz.service'

const claimSchema = z.object({ sessionId: z.string().uuid() })

const claimRoute: FastifyPluginAsync = async (app) => {
  app.post('/claim', { preHandler: app.authenticate }, async (request, reply) => {
    // Гостям не доступна раздача бонусов за квиз
    if (request.user.type === 'guest') {
      return reply.status(403).send({ error: 'Доступно после входа' })
    }

    const parsed = claimSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message })
    }

    try {
      const result = await app.prisma.$transaction(async (tx) => {
        return claimQuizBonus(tx, parsed.data.sessionId, request.user.userId)
      })
      return reply.send(result)
    } catch (err) {
      if (err instanceof Error && err.message === 'Session not found') {
        return reply.status(404).send({ error: 'Session not found' })
      }
      if (err instanceof Error && err.message === 'IDOR') {
        return reply.status(409).send({ error: 'Session already claimed by another user' })
      }
      throw err
    }
  })
}

export default claimRoute
