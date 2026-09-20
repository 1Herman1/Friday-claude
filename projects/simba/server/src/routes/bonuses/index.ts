import { FastifyPluginAsync } from 'fastify'

const bonusesRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/transactions',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { userId } = request.user

      const transactions = await app.prisma.bonusTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          comment: true,
          createdAt: true,
          orderId: true,
        },
      })

      return reply.send(transactions)
    }
  )
}

export default bonusesRoutes
