import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import * as bcrypt from 'bcryptjs'
import { findAdminByUsername } from '../../services/auth.service'

const ADMIN_LOGIN_MAX_ATTEMPTS = 5
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000

const adminLoginAttempts = new Map<string, { attempts: number; lastAttempt: Date }>()

// Dummy hash для защиты от timing-атак (всегда выполняем bcrypt.compare)
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing-resistance', 10)

const bodySchema = z.object({
  username: z.string().min(1, 'Логин обязателен'),
  password: z.string().min(1, 'Пароль обязателен'),
})

const adminLogin: FastifyPluginAsync = async (app) => {
  app.post('/admin-login', async (request, reply) => {
    const result = bodySchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message })
    }

    const { username, password } = result.data
    const clientIp = request.ip

    // Rate limiting по IP-адресу
    const now = new Date()
    const record = adminLoginAttempts.get(clientIp)
    if (record) {
      const windowExpired = now.getTime() - record.lastAttempt.getTime() > ADMIN_LOGIN_WINDOW_MS
      if (windowExpired) {
        adminLoginAttempts.delete(clientIp)
      } else if (record.attempts >= ADMIN_LOGIN_MAX_ATTEMPTS) {
        return reply.status(429).send({ error: 'Слишком много попыток входа. Попробуйте через 15 минут.' })
      }
    }

    const user = await findAdminByUsername(app.prisma, username)

    // Защита от timing-атаки: всегда вызываем bcrypt.compare
    // Используем реальный хеш если он есть, иначе dummy hash
    const passwordHashToCompare = user?.passwordHash ?? DUMMY_HASH
    const isPasswordValid = await bcrypt.compare(password, passwordHashToCompare)

    // Проверяем все условия, но всё равно потратили время на bcrypt.compare
    if (!user || user.role === 'customer' || !user.passwordHash || !isPasswordValid || !user.isActive) {
      // Увеличиваем счётчик неудачных попыток
      const current = adminLoginAttempts.get(clientIp)
      adminLoginAttempts.set(clientIp, {
        attempts: (current?.attempts ?? 0) + 1,
        lastAttempt: now,
      })
      return reply.status(401).send({ error: 'Неверный логин или пароль' })
    }

    // Успешный вход — сбрасываем счётчик
    adminLoginAttempts.delete(clientIp)

    const token = app.jwt.sign(
      { userId: user.id, role: user.role },
      { expiresIn: '7d' }
    )

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
        bonusPoints: user.bonusPoints,
        bonusLevel: user.bonusLevel,
      },
    })
  })
}

export default adminLogin
