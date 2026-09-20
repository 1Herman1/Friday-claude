import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { otpService } from '../../services/otp.service'
import { findOrCreateCustomerByEmail, normalizeEmail } from '../../services/customer.service'

const bodySchema = z.object({
  email: z.string().email(),
})

// Rate limit по IP: 5 запросов / 15 минут
const sendOtpIpAttempts = new Map<string, { attempts: number; resetAt: Date }>()
const SEND_OTP_RATE_LIMIT = 5
const SEND_OTP_WINDOW_MS = 15 * 60 * 1000

const sendOtp: FastifyPluginAsync = async (app) => {
  app.post('/send-otp', async (request, reply) => {
    const result = bodySchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message })
    }

    const { email } = result.data
    const normalizedEmail = normalizeEmail(email)

    // Rate limit по IP
    const clientIp = request.ip
    const now = new Date()
    let ipRecord = sendOtpIpAttempts.get(clientIp)

    if (ipRecord) {
      if (now.getTime() < ipRecord.resetAt.getTime()) {
        if (ipRecord.attempts >= SEND_OTP_RATE_LIMIT) {
          return reply.status(429).send({ error: 'Слишком много запросов. Попробуйте через 15 минут.' })
        }
      } else {
        sendOtpIpAttempts.delete(clientIp)
        ipRecord = undefined
      }
    }

    sendOtpIpAttempts.set(clientIp, {
      attempts: (ipRecord?.attempts ?? 0) + 1,
      resetAt: ipRecord?.resetAt || new Date(now.getTime() + SEND_OTP_WINDOW_MS),
    })

    // Найти или создать пользователя по email
    const userId = await findOrCreateCustomerByEmail(app.prisma, normalizedEmail)

    // Rate limit: не чаще одного запроса в 60 секунд.
    // Только коды входа: запрос кода на удаление или смену почты вход не блокирует.
    const recentOtp = await app.prisma.otpCode.findFirst({
      where: {
        userId,
        purpose: 'login',
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (recentOtp) {
      return reply.status(429).send({ error: 'Повторный запрос возможен через 60 секунд' })
    }

    // Удалить старые неиспользованные коды входа. Коды других сценариев не
    // трогаем: запрос входа не должен гасить начатое удаление или смену почты.
    await app.prisma.otpCode.deleteMany({
      where: { userId, usedAt: null, purpose: 'login' },
    })

    const code = await otpService.createOtp(app.prisma, userId, 'email', 'login', normalizedEmail)

    await otpService.sendEmail(normalizedEmail, code)

    return reply.send({
      message: 'Код отправлен',
      channel: 'email',
      expiresIn: 600,
    })
  })
}

export default sendOtp
