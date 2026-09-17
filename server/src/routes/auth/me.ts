import { FastifyPluginAsync } from 'fastify'
import { hasPdConsent } from '../../services/consent.service'

const me: FastifyPluginAsync = async (app) => {
  app.get('/me', { preHandler: app.authenticate }, async (request, reply) => {
    const { userId, type } = request.user as { userId: string; type?: string }

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: true,
        pets: true,
      },
    })

    if (!user) {
      return reply.status(404).send({ error: 'Пользователь не найден' })
    }

    const pdConsent = type === 'guest' ? false : await hasPdConsent(app.prisma, userId)

    return reply.send({
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      bonusPoints: user.bonusPoints,
      bonusLevel: user.bonusLevel,
      isGuest: type === 'guest',
      hasPdConsent: pdConsent,
      addresses: user.addresses,
      pets: user.pets,
    })
  })
}

export default me
