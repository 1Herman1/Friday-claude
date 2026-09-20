import { FastifyPluginAsync } from 'fastify'

const GUEST_SESSION_RATE_LIMIT = 10 // в час
const GUEST_SESSION_WINDOW_MS = 60 * 60 * 1000 // 1 час

const guestSessionAttempts = new Map<string, { attempts: number; resetAt: Date }>()

const guestSession: FastifyPluginAsync = async (app) => {
  app.post('/guest-session', async (request, reply) => {
    // Получить IP клиента для rate-limiting
    const clientIp = request.ip

    const now = new Date()
    let record = guestSessionAttempts.get(clientIp)

    // Проверить, истёк ли временной окне
    if (record) {
      if (now.getTime() < record.resetAt.getTime()) {
        if (record.attempts >= GUEST_SESSION_RATE_LIMIT) {
          return reply
            .status(429)
            .send({ error: 'Слишком много попыток. Попробуйте позже.' })
        }
      } else {
        guestSessionAttempts.delete(clientIp)
        record = undefined
      }
    }

    // Создать гостевого пользователя
    const guestUser = await app.prisma.user.create({
      data: {
        name: 'Гость',
        role: 'customer',
        // Важно: true, чтобы гостевой аккаунт не участвовал в раздаче приветственного бонуса
        welcomeBonusGranted: true,
      },
    })

    // Создать гостевую корзину
    await app.prisma.cart.create({
      data: { userId: guestUser.id },
    })

    // Подписать JWT с типом 'guest'
    const token = app.jwt.sign(
      { userId: guestUser.id, role: guestUser.role, type: 'guest' },
      { expiresIn: '30d' }
    )

    // Обновить rate-limit счётчик
    if (record) {
      guestSessionAttempts.set(clientIp, {
        attempts: record.attempts + 1,
        resetAt: record.resetAt,
      })
    } else {
      guestSessionAttempts.set(clientIp, {
        attempts: 1,
        resetAt: new Date(now.getTime() + GUEST_SESSION_WINDOW_MS),
      })
    }

    return reply.send({ token })
  })
}

export default guestSession
