import { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { otpService } from '../../services/otp.service'
import { normalizeEmail } from '../../services/customer.service'
import { hasPdConsent } from '../../services/consent.service'

const NAME_ERROR = 'Имя должно быть от 2 до 60 символов'

const profileSchema = z.object({
  name: z.string().trim().min(2, NAME_ERROR).max(60, NAME_ERROR).optional(),
  phone: z.string().optional(),
})

const emailRequestSchema = z.object({
  email: z.string().email(),
})

// Два кода, а не один: code подтверждает владение НОВЫМ ящиком, currentCode —
// владение аккаунтом. Иначе украденная сессия уводит аккаунт навсегда: вход
// идёт по коду на почту, и после подмены адреса владельцу входить нечем.
const emailConfirmSchema = z.object({
  email: z.string().email(),
  currentCode: z.string().length(6),
  code: z.string().length(6),
})

const EMAIL_REQUEST_WINDOW_MS = 60 * 1000
const emailRequestRateLimit = new Map<string, { resetAt: Date }>()

// Второй лимит — по IP, по образцу routes/auth/send-otp.ts: перебор адресов не
// должен масштабироваться количеством аккаунтов у перебирающего.
const EMAIL_REQUEST_IP_LIMIT = 5
const EMAIL_REQUEST_IP_WINDOW_MS = 15 * 60 * 1000
const emailRequestIpAttempts = new Map<string, { attempts: number; resetAt: Date }>()

const EMAIL_MAX_ATTEMPTS = 5
const EMAIL_ATTEMPTS_WINDOW_MS = 15 * 60 * 1000
const emailAttempts = new Map<string, { attempts: number; lastAttempt: Date }>()

// Сохранение профиля тоже ограничиваем: ответ «этот телефон уже привязан» иначе
// превращается в перебор — узнать, есть ли номер в базе магазина.
const PROFILE_SAVE_LIMIT = 10
const PROFILE_SAVE_WINDOW_MS = 15 * 60 * 1000
const profileSaveAttempts = new Map<string, { attempts: number; resetAt: Date }>()

/** Карты лимитов живут в памяти процесса: подчищаем протухшее, иначе они растут без предела. */
function sweep(map: Map<string, { resetAt?: Date; lastAttempt?: Date }>, windowMs: number, now: number) {
  for (const [key, value] of map) {
    const until = value.resetAt?.getTime() ?? (value.lastAttempt ? value.lastAttempt.getTime() + windowMs : 0)
    if (until <= now) map.delete(key)
  }
}

/** Тот же алгоритм, что в client/src/lib/phone.ts — на сервере своей копии не было. */
function normalizePhoneRu(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('8')) return '7' + digits.slice(1)
  if (digits.startsWith('7')) return digits
  if (digits.length === 10) return '7' + digits
  return digits
}

function isValidPhoneRu(value: string): boolean {
  return /^7[1-9]\d{9}$/.test(value)
}

const profileRoutes: FastifyPluginAsync = async (app) => {
  /** Ровно тот объект, что отдаёт GET /api/auth/me: клиент кладёт ответ прямо в state. */
  async function profileResponse(userId: string) {
    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      include: { addresses: true, pets: true },
    })

    if (!user || user.deletedAt) return null

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      bonusPoints: user.bonusPoints,
      bonusLevel: user.bonusLevel,
      isGuest: false,
      hasPdConsent: await hasPdConsent(app.prisma, userId),
      addresses: user.addresses,
      pets: user.pets,
    }
  }

  app.put('/profile', { preHandler: app.authenticate }, async (request, reply) => {
    const { userId, type } = request.user as { userId: string; type?: string }

    if (type === 'guest') {
      return reply.status(403).send({ error: 'У гостевой сессии нет профиля' })
    }

    // email из тела не читаем: адрес меняется только через подтверждение кодом
    const parsed = profileSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message })
    }

    // Лимит до обращений к базе: ответ про занятый телефон иначе служит оракулом
    const nowMs = Date.now()
    sweep(profileSaveAttempts, PROFILE_SAVE_WINDOW_MS, nowMs)
    const saveRecord = profileSaveAttempts.get(userId)
    if (saveRecord && saveRecord.resetAt.getTime() > nowMs) {
      if (saveRecord.attempts >= PROFILE_SAVE_LIMIT) {
        return reply.status(429).send({ error: 'Слишком много изменений. Попробуйте через 15 минут.' })
      }
      saveRecord.attempts += 1
    } else {
      profileSaveAttempts.set(userId, { attempts: 1, resetAt: new Date(nowMs + PROFILE_SAVE_WINDOW_MS) })
    }

    const data: { name?: string; phone?: string | null } = {}

    if (parsed.data.name !== undefined) {
      data.name = parsed.data.name
    }

    if (parsed.data.phone !== undefined) {
      const raw = parsed.data.phone.trim()
      if (raw === '') {
        data.phone = null
      } else {
        const phone = normalizePhoneRu(raw)
        if (!isValidPhoneRu(phone)) {
          return reply.status(400).send({ error: 'Проверьте номер телефона' })
        }
        data.phone = phone
      }
    }

    const current = await app.prisma.user.findUnique({ where: { id: userId } })
    if (!current || current.deletedAt) {
      return reply.status(404).send({ error: 'Пользователь не найден' })
    }

    if (Object.keys(data).length > 0) {
      try {
        await app.prisma.user.update({ where: { id: userId }, data })
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return reply.status(409).send({ error: 'Этот телефон уже привязан к другому аккаунту' })
        }
        throw err
      }
    }

    const profile = await profileResponse(userId)
    if (!profile) {
      return reply.status(404).send({ error: 'Пользователь не найден' })
    }

    return reply.send(profile)
  })

  app.post('/profile/email-request', { preHandler: app.authenticate }, async (request, reply) => {
    const { userId, type } = request.user as { userId: string; type?: string }

    if (type === 'guest') {
      return reply.status(403).send({ error: 'У гостевой сессии нет профиля' })
    }

    const parsed = emailRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Проверьте адрес электронной почты' })
    }

    // Лимиты стоят ДО обращений к базе, и попытка засчитывается на любом
    // исходе, включая 400. Занятость адреса тут не проверяется вовсе: ответ
    // одинаков для любого чужого адреса, иначе форма работает оракулом —
    // кто из посторонних зарегистрирован в магазине.
    const now = new Date()
    const clientIp = request.ip
    sweep(emailRequestIpAttempts, EMAIL_REQUEST_IP_WINDOW_MS, Date.now())
    let ipRecord = emailRequestIpAttempts.get(clientIp)

    if (ipRecord) {
      if (now.getTime() < ipRecord.resetAt.getTime()) {
        if (ipRecord.attempts >= EMAIL_REQUEST_IP_LIMIT) {
          return reply.status(429).send({ error: 'Слишком много запросов. Попробуйте через 15 минут.' })
        }
      } else {
        emailRequestIpAttempts.delete(clientIp)
        ipRecord = undefined
      }
    }

    sweep(emailRequestRateLimit, EMAIL_REQUEST_WINDOW_MS, Date.now())
    const limit = emailRequestRateLimit.get(userId)
    if (limit) {
      if (now.getTime() < limit.resetAt.getTime()) {
        return reply.status(429).send({ error: 'Повторный запрос возможен через 60 секунд' })
      }
      emailRequestRateLimit.delete(userId)
    }

    emailRequestIpAttempts.set(clientIp, {
      attempts: (ipRecord?.attempts ?? 0) + 1,
      resetAt: ipRecord?.resetAt || new Date(now.getTime() + EMAIL_REQUEST_IP_WINDOW_MS),
    })
    emailRequestRateLimit.set(userId, { resetAt: new Date(now.getTime() + EMAIL_REQUEST_WINDOW_MS) })

    const email = normalizeEmail(parsed.data.email)

    const user = await app.prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.deletedAt) {
      return reply.status(404).send({ error: 'Пользователь не найден' })
    }

    if (!user.email) {
      return reply.status(400).send({ error: 'К аккаунту не привязана почта' })
    }

    if (user.email === email) {
      return reply.status(400).send({ error: 'Это ваш текущий адрес' })
    }

    // Занятость адреса не проверяем: код уходит в любом случае, а столкновение
    // ловится на подтверждении (P2002). Иначе залогиненный перебором выясняет
    // клиентскую базу магазина, и рейт-лимит это только замедляет.

    // Гасим только свои же незавершённые смены адреса: коды входа и удаления
    // аккаунта остаются жить, иначе две открытые вкладки перебивают друг друга.
    await app.prisma.otpCode.deleteMany({ where: { userId, usedAt: null, purpose: 'email_change' } })

    // Коды разные и адреса разные: один уходит владельцу аккаунта, второй — на
    // заявленный новый ящик. Оба под сценарием email_change, различает их target.
    const currentCode = await otpService.createOtp(app.prisma, userId, 'email', 'email_change', user.email)
    const newCode = await otpService.createOtp(app.prisma, userId, 'email', 'email_change', email)

    try {
      await otpService.sendEmail(user.email, currentCode, 'email_change_current', { newEmail: email })
      await otpService.sendEmail(email, newCode, 'email_change')
    } catch (err) {
      // Письмо не ушло — минуту ожидания покупатель не заслужил, лимит снимаем
      emailRequestRateLimit.delete(userId)
      request.log.error({ err }, 'Не удалось отправить коды подтверждения смены адреса')
      return reply.status(502).send({ error: 'Не удалось отправить письмо. Попробуйте позже.' })
    }

    return reply.send({ ok: true })
  })

  app.put('/profile/email', { preHandler: app.authenticate }, async (request, reply) => {
    const { userId, type } = request.user as { userId: string; type?: string }

    if (type === 'guest') {
      return reply.status(403).send({ error: 'У гостевой сессии нет профиля' })
    }

    const parsed = emailConfirmSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Введите код из письма' })
    }

    const email = normalizeEmail(parsed.data.email)
    const { code, currentCode } = parsed.data

    const now = new Date()
    sweep(emailAttempts, EMAIL_ATTEMPTS_WINDOW_MS, Date.now())
    const record = emailAttempts.get(userId)
    if (record) {
      if (now.getTime() - record.lastAttempt.getTime() > EMAIL_ATTEMPTS_WINDOW_MS) {
        emailAttempts.delete(userId)
      } else if (record.attempts >= EMAIL_MAX_ATTEMPTS) {
        return reply.status(429).send({ error: 'Слишком много попыток. Попробуйте через 15 минут.' })
      }
    }

    const rejectCode = () => {
      const current = emailAttempts.get(userId)
      emailAttempts.set(userId, { attempts: (current?.attempts ?? 0) + 1, lastAttempt: now })
      return reply.status(400).send({ error: 'Неверный или просроченный код' })
    }

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, deletedAt: true },
    })
    if (!user || user.deletedAt) {
      return reply.status(404).send({ error: 'Пользователь не найден' })
    }
    if (!user.email) {
      return reply.status(400).send({ error: 'К аккаунту не привязана почта' })
    }

    // Ожидаемый адрес берётся из самого кода (OtpCode.target): подтвердить можно
    // только тот адрес, на который код реально ушёл, и только кодом смены почты.
    // Коды ищем, не гася: неверный второй не должен сжигать верный первый.
    const currentOtp = await otpService.findValidOtp(
      app.prisma,
      userId,
      currentCode,
      'email_change',
      user.email
    )
    const newOtp = await otpService.findValidOtp(app.prisma, userId, code, 'email_change', email)

    // currentOtp.id === newOtp.id — это один и тот же код, введённый дважды:
    // у кодов без target (выпущенных до появления поля) он подходит к обеим
    // проверкам, а по контракту одна бумажка две роли не закрывает.
    if (!currentOtp || !newOtp || currentOtp.id === newOtp.id) {
      return rejectCode()
    }

    // Гасим оба разом: если параллельный запрос успел забрать любой из них,
    // не сгорает ни один.
    const consumed = await otpService.consumeOtps(app.prisma, [currentOtp.id, newOtp.id])
    if (!consumed) {
      return rejectCode()
    }

    emailAttempts.delete(userId)

    // Смена адреса гасит все ранее выданные токены. Ради этого и заводились два
    // кода: угнанная сессия не должна пережить возврат адреса владельцем.
    const revokedAt = new Date()

    try {
      await app.prisma.user.update({
        where: { id: userId },
        data: { email, sessionsValidFrom: revokedAt },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          return reply.status(409).send({ error: 'Этот адрес уже занят' })
        }
        if (err.code === 'P2025') {
          return reply.status(404).send({ error: 'Пользователь не найден' })
        }
      }
      throw err
    }

    // Прежний адрес узнаёт о смене — иначе перехваченный доступ к почте меняет
    // адрес молча. Сбой отправки не откатывает смену: она уже состоялась.
    if (user.email !== email) {
      try {
        await otpService.sendEmailChangedNotice(user.email, email)
      } catch (err) {
        request.log.error({ err }, 'Не удалось уведомить прежний адрес о смене почты')
      }
    }

    const profile = await profileResponse(userId)
    if (!profile) {
      return reply.status(404).send({ error: 'Пользователь не найден' })
    }

    // Токен, которым покупатель только что подтвердил смену, тоже погашен —
    // мы не знаем, чей он. Поэтому в ответе сразу свежий: время подписи
    // округляем вверх до секунды, потому что в JWT оно в секундах, а отметка в
    // миллисекундах, и подписанный «в ту же секунду» токен иначе оказался бы
    // старше отметки и умер бы на первом же запросе.
    const token = app.jwt.sign(
      { userId, role: profile.role },
      { expiresIn: '7d', clockTimestamp: Math.ceil(revokedAt.getTime() / 1000) * 1000 }
    )

    return reply.send({ user: profile, token })
  })
}

export default profileRoutes
