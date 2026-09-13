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
    try {
      await request.jwtVerify()

      // Update lastSeenAt for non-guest users, throttled to once per 10 minutes
      const payload = request.user as { userId?: string; role?: string } | undefined
      if (payload?.userId && payload.role !== 'guest') {
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
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  app.decorate('authenticateOptional', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()

      // Same throttled update for optional auth
      const payload = request.user as { userId?: string; role?: string } | undefined
      if (payload?.userId && payload.role !== 'guest') {
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
