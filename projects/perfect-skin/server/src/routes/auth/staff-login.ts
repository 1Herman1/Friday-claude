import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import bcryptjs from 'bcryptjs'
import { ApiError } from '../../lib/errors.js'
import { isProduction, cookieInsecure } from '../../lib/env.js'
import { STAFF_ROLES } from '../../lib/pricing.js'
const { sign } = jwt

const loginSchema = z.object({
  login: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(200),
})

// Хеш-пустышка: без него отсутствующий логин отвечал бы быстрее и выдавал себя.
const DUMMY_HASH = bcryptjs.hashSync('dummy-password-for-timing', 12)

export async function staffLoginRoute(app: FastifyInstance) {
  app.post(
    '/api/v1/auth/staff-login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
          keyGenerator: (req: FastifyRequest) =>
            `${req.ip}:${String((req.body as { login?: string } | null)?.login ?? '').toLowerCase()}`,
        },
      },
    },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body)
      if (!parsed.success) {
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'Неверный логин или пароль')
      }
      const { login, password } = parsed.data

      const user = await app.prisma.user.findUnique({ where: { login } })
      const ok = await bcryptjs.compare(password, user?.passwordHash ?? DUMMY_HASH)

      if (!user || !ok || !user.passwordHash || !user.isActive || !STAFF_ROLES.includes(user.role)) {
        app.log.warn({ login }, 'Staff login failed')
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'Неверный логин или пароль')
      }

      const token = sign(
        { userId: user.id, role: user.role, tv: user.tokenVersion },
        process.env.JWT_SECRET || 'dev-secret',
        { expiresIn: '7 days' }
      )

      reply.setCookie('ps_auth', token, {
        httpOnly: true,
        secure: isProduction && !cookieInsecure,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 3600,
      })

      app.log.info({ user_id: user.id }, 'Staff login')
      return { ok: true }
    }
  )
}
