import fp from 'fastify-plugin'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    authenticateOptional: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

const lastSeenMap = new Map<string, number>()
const THROTTLE_MS = 10 * 60 * 1000 // 10 minutes

type JwtPayload = { userId?: string; role?: string; type?: 'guest'; iat?: number }

/**
 * Обновить lastSeenAt для пользователя с троттлингом.
 * Используется для гостей и зарегистрированных; ошибка обновления игнорируется.
 */
async function touchLastSeen(app: FastifyInstance, userId: string): Promise<void> {
  const now = Date.now()
  const lastSeen = lastSeenMap.get(userId) ?? 0

  if (now - lastSeen > THROTTLE_MS) {
    lastSeenMap.set(userId, now)

    await app.prisma.user
      .update({
        where: { id: userId },
        data: { lastSeenAt: new Date() },
      })
      .catch((err: unknown) => {
      // P2025 — строки уже нет: гостя мог удалить ночной прогон, это штатно.
      // Остальное (таймаут, обрыв соединения) молчать не должно.
      if ((err as { code?: string })?.code !== 'P2025') {
        app.log.warn({ err, userId }, 'Не удалось обновить отметку последнего визита')
      }
    })
  }
}

/**
 * Токен, подписанный до отметки sessionsValidFrom, недействителен.
 *
 * Токен живёт 7 дней, поэтому смена почты, блокировка и обезличивание обязаны
 * гасить ранее выданные сессии сразу: иначе угнанный доступ переживает возврат
 * адреса владельцем. iat в JWT хранится в секундах, отметка — в миллисекундах.
 * Токен без iat датировать нечем, поэтому при наличии отметки он тоже мёртв.
 */
function isSessionRevoked(sessionsValidFrom: Date | null, iat: number | undefined): boolean {
  if (!sessionsValidFrom) return false
  if (typeof iat !== 'number') return true
  return iat * 1000 < sessionsValidFrom.getTime()
}

export default fp(async (app) => {
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    // JWT verification in separate try/catch: DB errors should not cause 401
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    // Type the JWT payload to include type field for guest detection
    const payload = request.user as JwtPayload | undefined
    if (!payload?.userId) return

    if (payload.type !== 'guest') {
      try {
        // Один запрос в БД на пользователя перед throttle: проверить заблокирован ли
        // и не старше ли токен отметки гашения сессий
        const u = await app.prisma.user.findUnique({
          where: { id: payload.userId },
          select: { isActive: true, sessionsValidFrom: true },
        })
        if (u && !u.isActive) {
          return reply.status(401).send({ error: 'Аккаунт заблокирован', code: 'USER_BLOCKED' })
        }
        if (u && isSessionRevoked(u.sessionsValidFrom, payload.iat)) {
          return reply
            .status(401)
            .send({ error: 'Сессия завершена, войдите заново', code: 'SESSION_REVOKED' })
        }
      } catch (err) {
        request.log.error(err)
        return reply.status(500).send({ error: 'Ошибка сервера' })
      }
    }

    // Fire-and-forget: update lastSeenAt for both guests and registered users
    touchLastSeen(app, payload.userId).catch(() => {}) // eslint-disable-line @typescript-eslint/no-floating-promises
  })

  app.decorate('authenticateOptional', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()

      const payload = request.user as JwtPayload | undefined
      if (!payload?.userId) return

      if (payload.type !== 'guest') {
        // Заблокированный, обезличенный или погашенный по отметке токен — аноним, а не пользователь
        const u = await app.prisma.user.findUnique({
          where: { id: payload.userId },
          select: { isActive: true, sessionsValidFrom: true },
        })
        if (!u || !u.isActive || isSessionRevoked(u.sessionsValidFrom, payload.iat)) {
          ;(request as { user: unknown }).user = null
          return
        }
      }

      // Fire-and-forget: update lastSeenAt for both guests and registered users
      touchLastSeen(app, payload.userId).catch(() => {}) // eslint-disable-line @typescript-eslint/no-floating-promises
    } catch {
      // гость — это нормальный сценарий квиза, не ошибка
    }
  })
})
