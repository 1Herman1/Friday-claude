import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { anonymizeUser, exportUserData, AccountNotFoundError } from '../../services/account.service'
import { otpService } from '../../services/otp.service'

const deleteRequestSchema = z.object({})
const deleteSchema = z.object({
  code: z.string().length(6),
})

const deleteRequestRateLimit = new Map<string, { attempts: number; resetAt: Date }>()
const DELETE_REQUEST_RATE_LIMIT_WINDOW_MS = 60 * 1000

const deleteAttempts = new Map<string, { attempts: number; lastAttempt: Date }>()
const DELETE_MAX_ATTEMPTS = 5
const DELETE_WINDOW_MS = 15 * 60 * 1000

const accountRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me/export', { preHandler: app.authenticate }, async (request, reply) => {
    const { userId, type } = request.user as { userId: string; type?: string }

    if (type === 'guest') {
      return reply.status(403).send({ error: 'У гостевой сессии нет аккаунта' })
    }

    try {
      const data = await exportUserData(app.prisma, userId)
      const filename = `simba-data-${new Date().toISOString().split('T')[0]}.json`
      reply.header('Content-Disposition', `attachment; filename="${filename}"`)
      reply.header('Content-Type', 'application/json')
      reply.header('Cache-Control', 'private, no-store')
      return reply.send(data)
    } catch (error) {
      if (error instanceof AccountNotFoundError) {
        return reply.status(404).send({ error: error.message })
      }
      throw error
    }
  })

  app.post('/me/delete-request', { preHandler: app.authenticate }, async (request, reply) => {
    const { userId, type } = request.user as { userId: string; role: string; type?: string }

    if (type === 'guest') {
      return reply.status(403).send({ error: 'У гостевой сессии нет аккаунта' })
    }

    const userRole = request.user.role as string
    if (userRole !== 'customer') {
      return reply.status(403).send({ error: 'Аккаунт сотрудника удаляет администратор' })
    }

    // Проверить что есть email
    const user = await app.prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.email) {
      return reply.status(400).send({ error: 'К аккаунту не привязана почта' })
    }

    // Рейт-лимит 60 секунд на пользователя
    const now = new Date()
    const userRecord = deleteRequestRateLimit.get(userId)

    if (userRecord) {
      if (now.getTime() < userRecord.resetAt.getTime()) {
        return reply.status(429).send({ error: 'Повторный запрос возможен через 60 секунд' })
      } else {
        deleteRequestRateLimit.delete(userId)
      }
    }

    const attempts = (userRecord?.attempts ?? 0) + 1
    deleteRequestRateLimit.set(userId, {
      attempts,
      resetAt: new Date(now.getTime() + DELETE_REQUEST_RATE_LIMIT_WINDOW_MS),
    })

    // Удалить старые неиспользованные коды удаления. Код входа и код смены
    // почты живут своей жизнью — их этот запрос не гасит.
    await app.prisma.otpCode.deleteMany({
      where: { userId, usedAt: null, purpose: 'delete' },
    })

    // Создать новый OTP код
    const code = await otpService.createOtp(app.prisma, userId, 'email', 'delete', user.email)

    // Отправить письмо
    await otpService.sendEmail(user.email, code, 'delete')

    return reply.send({ ok: true })
  })

  app.delete('/me', { preHandler: app.authenticate }, async (request, reply) => {
    const { userId, type } = request.user as { userId: string; role: string; type?: string }

    if (type === 'guest') {
      return reply.status(403).send({ error: 'У гостевой сессии нет аккаунта' })
    }

    const userRole = request.user.role as string
    if (userRole !== 'customer') {
      return reply.status(403).send({ error: 'Аккаунт сотрудника удаляет администратор' })
    }

    const result = deleteSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'Введите код из письма' })
    }

    const { code } = result.data

    // Проверка попыток
    const now = new Date()
    const record = deleteAttempts.get(userId)
    if (record) {
      const windowExpired = now.getTime() - record.lastAttempt.getTime() > DELETE_WINDOW_MS
      if (windowExpired) {
        deleteAttempts.delete(userId)
      } else if (record.attempts >= DELETE_MAX_ATTEMPTS) {
        return reply.status(429).send({ error: 'Слишком много попыток. Попробуйте через 15 минут.' })
      }
    }

    // Проверить код OTP: годится только код, выпущенный под удаление аккаунта
    const isValid = await otpService.verifyOtp(app.prisma, userId, code, 'delete')
    if (!isValid) {
      const current = deleteAttempts.get(userId)
      deleteAttempts.set(userId, {
        attempts: (current?.attempts ?? 0) + 1,
        lastAttempt: now,
      })
      return reply.status(400).send({ error: 'Неверный или просроченный код' })
    }

    deleteAttempts.delete(userId)

    try {
      await anonymizeUser(app.prisma, userId, {
        reason: 'self',
        ip: request.ip,
        userAgent: request.headers['user-agent'] || null,
      })

      return reply.send({ ok: true })
    } catch (error) {
      if (error instanceof AccountNotFoundError) {
        return reply.status(404).send({ error: error.message })
      }
      throw error
    }
  })
}

export default accountRoutes
