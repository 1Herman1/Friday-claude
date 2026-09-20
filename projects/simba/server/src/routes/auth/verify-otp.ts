import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { otpService } from '../../services/otp.service'
import { applyBonusChange } from '../../services/bonus.service'
import { normalizeEmail } from '../../services/customer.service'
import { mergeGuestCart } from '../../services/cart.service'
import { consentVersionSchema, consentSource, recordConsent, PD_CONSENT_VERSIONS } from '../../services/consent.service'

const WELCOME_BONUS = 300
const OTP_MAX_ATTEMPTS = 5
const OTP_WINDOW_MS = 15 * 60 * 1000

const otpAttempts = new Map<string, { attempts: number; lastAttempt: Date }>()

const bodySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  consentVersion: consentVersionSchema('Нужно согласие на обработку персональных данных', PD_CONSENT_VERSIONS),
  guestToken: z.string().optional(),
})

const verifyOtp: FastifyPluginAsync = async (app) => {
  app.post('/verify-otp', async (request, reply) => {
    const result = bodySchema.safeParse(request.body)
    if (!result.success) {
      const error = result.error.errors[0]
      let message = error.message
      if (error.path.includes('consentVersion') && error.code === 'invalid_type') {
        message = 'Нужно согласие на обработку персональных данных'
      }
      return reply.status(400).send({ error: message })
    }

    const { email, code, consentVersion, guestToken } = result.data
    const normalizedEmail = normalizeEmail(email)

    const now = new Date()
    const record = otpAttempts.get(normalizedEmail)
    if (record) {
      const windowExpired = now.getTime() - record.lastAttempt.getTime() > OTP_WINDOW_MS
      if (windowExpired) {
        otpAttempts.delete(normalizedEmail)
      } else if (record.attempts >= OTP_MAX_ATTEMPTS) {
        return reply.status(429).send({ error: 'Слишком много попыток. Попробуйте через 15 минут.' })
      }
    }

    const user = await app.prisma.user.findFirst({
      where: { email: normalizedEmail },
    })

    if (user && !user.isActive) {
      return reply.status(403).send({ error: 'Аккаунт заблокирован. Напишите нам в Telegram.' })
    }

    if (!user) {
      const current = otpAttempts.get(normalizedEmail)
      otpAttempts.set(normalizedEmail, {
        attempts: (current?.attempts ?? 0) + 1,
        lastAttempt: now,
      })
      return reply.status(400).send({ error: 'Неверный или истёкший код' })
    }

    // Только код входа и только выданный на этот адрес: код со смены почты
    // или удаления аккаунта здесь не подходит.
    const isValid = await otpService.verifyOtp(app.prisma, user.id, code, 'login', normalizedEmail)
    if (!isValid) {
      const current = otpAttempts.get(normalizedEmail)
      otpAttempts.set(normalizedEmail, {
        attempts: (current?.attempts ?? 0) + 1,
        lastAttempt: now,
      })
      return reply.status(400).send({ error: 'Неверный или истёкший код' })
    }

    otpAttempts.delete(normalizedEmail)

    // Записать согласие на обработку ПД
    const source = consentSource(request)
    await recordConsent(app.prisma, {
      userId: user.id,
      kind: 'pd_processing',
      textVersion: consentVersion,
      ip: source.ip,
      userAgent: source.userAgent,
    })

    // Проверить гостевой токен, если пришёл
    let guestUserId: string | null = null
    if (guestToken) {
      try {
        const decoded = (await app.jwt.verify(guestToken)) as { userId?: string; type?: string }
        if (decoded.type === 'guest' && decoded.userId) {
          guestUserId = decoded.userId
        }
      } catch {
        // Истёкший или битый токен — просто игнорируем, вход идёт нормально
      }
    }

    // Приветственные бонусы — один раз, в момент первого подтверждённого входа.
    // Условие в updateMany делает выдачу идемпотентной: два одновременных
    // подтверждения не начислят дважды.
    let bonusGranted = 0
    const granted = await app.prisma.user.updateMany({
      where: { id: user.id, welcomeBonusGranted: false },
      data: { welcomeBonusGranted: true },
    })

    if (granted.count === 1) {
      await app.prisma.$transaction(async (tx) => {
        await applyBonusChange(tx, {
          userId: user.id,
          amount: WELCOME_BONUS,
          type: 'welcome',
          comment: 'Приветственные бонусы за регистрацию',
        })
      })
      bonusGranted = WELCOME_BONUS
    }

    // Слить гостевую корзину если есть валидный гостевой токен
    let cartMerged = false
    if (guestUserId) {
      await app.prisma.$transaction(async (tx) => {
        await mergeGuestCart(tx, guestUserId, user.id)
      })
      cartMerged = true
    }

    const fresh = await app.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { bonusPoints: true, bonusLevel: true },
    })

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
        bonusPoints: fresh.bonusPoints,
        bonusLevel: fresh.bonusLevel,
      },
      // Только факт выдачи в этом запросе. Признак «баланс ≥ 300» показывал бы
      // попап при каждом входе любому, кто бонусы ещё не потратил.
      bonusGranted,
      // Был ли выполнен мерж корзины. Если нет — клиент покажет ошибку.
      cartMerged,
    })
  })
}

export default verifyOtp
