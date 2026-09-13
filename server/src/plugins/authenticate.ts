import fp from 'fastify-plugin'
import { FastifyRequest, FastifyReply } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    authenticateOptional: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

const lastSeenMap = new Map<string, number>()
const THROTTLE_MS = 10 * 60 * 1000 // 10 minutes

export default fp(async (app) => {
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    // JWT verification in separate try/catch: DB errors should not cause 401
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    // Type the JWT payload to include type field for guest detection
    const payload = request.user as { userId?: string; role?: string; type?: 'guest' } | undefined
    if (payload?.userId && payload.type !== 'guest') {
      try {
        // Один запрос в БД на пользователя перед throttle: проверить заблокирован ли
        const u = await app.prisma.user.findUnique({
          where: { id: payload.userId },
          select: { isActive: true },
        })
        if (u && !u.isActive) {
          return reply.status(401).send({ error: 'Аккаунт заблокирован', code: 'USER_BLOCKED' })
        }
      } catch (err) {
        request.log.error(err)
        return reply.status(500).send({ error: 'Ошибка сервера' })
      }

      const now = Date.now()
      const lastSeen = lastSeenMap.get(payload.userId) ?? 0

      if (now - lastSeen > THROTTLE_MS) {
        lastSeenMap.set(payload.userId, now)

        // Fire-and-forget: update in background, don't block request
        app.prisma.user
          .update({
            where: { id: payload.userId },
            data: { lastSeenAt: new Date() },
          })
          .catch(() => {
            // Silent failure: don't throw if update fails
          })
      }
    }
  })

  app.decorate('authenticateOptional', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()

      // Same throttled update for optional auth, but don't block guests
      const payload = request.user as { userId?: string; role?: string; type?: 'guest' } | undefined
      if (payload?.userId && payload.type !== 'guest') {
        const now = Date.now()
        const lastSeen = lastSeenMap.get(payload.userId) ?? 0

        if (now - lastSeen > THROTTLE_MS) {
          lastSeenMap.set(payload.userId, now)

          app.prisma.user
            .update({
              where: { id: payload.userId },
              data: { lastSeenAt: new Date() },
            })
            .catch(() => {
              // Silent failure: don't throw if update fails
            })
        }
      }
    } catch {
      // гость — это нормальный сценарий квиза, не ошибка
    }
  })
})
