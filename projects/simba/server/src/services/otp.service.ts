import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { PrismaClient } from '@prisma/client'
import { OtpChannel, OtpPurpose } from '../types'

function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

/**
 * Перец (pepper) для кодов подтверждения.
 *
 * Голый SHA-256 от шестизначного числа не защищает ничего: всё пространство —
 * 900 000 значений, радужная таблица строится за секунды, и любой дамп
 * otp_codes (бэкап, доступ к базе) читается как открытый текст. Этой же
 * таблицей теперь подтверждают удаление аккаунта и смену почты, поэтому цена
 * дампа выросла. HMAC с серверным секретом делает такую таблицу бесполезной:
 * без секрета её не построить.
 *
 * Свой OTP_PEPPER предпочтительнее — тогда утечка JWT_SECRET не раскрывает
 * коды, и наоборот. Но если его не задали, берём JWT_SECRET: он на проде уже
 * есть и не пуст, так что выкатка не требует заводить новый секрет заранее.
 */
function resolveOtpPepper(): string {
  const pepper = process.env.OTP_PEPPER || process.env.JWT_SECRET
  if (pepper) {
    return pepper
  }

  // Тесты поднимаются без секретов (vitest сам выставляет NODE_ENV=test), а
  // коды в них и создаются, и проверяются одним процессом — постоянной строки
  // достаточно. На сервере такой поблажки нет: там падаем при старте, как
  // падает регистрация @fastify/jwt без JWT_SECRET (см. src/index.ts).
  if (process.env.NODE_ENV === 'test') {
    return 'test-otp-pepper'
  }

  throw new Error(
    'Не задан ни OTP_PEPPER, ни JWT_SECRET — коды подтверждения нечем солить. ' +
      'Задайте OTP_PEPPER в окружении сервера (см. .env.example).'
  )
}

const OTP_PEPPER = resolveOtpPepper()

function hashCode(code: string): string {
  return crypto.createHmac('sha256', OTP_PEPPER).update(code).digest('hex')
}

/**
 * Обратный адрес писем — он же адрес поддержки в их тексте: отдельного ящика
 * поддержки в конфиге нет, а ответ владельца удобнее получать туда же, откуда
 * ушло письмо. Заведут свой ящик — правится здесь, в одном месте.
 */
const SUPPORT_EMAIL = process.env.SMTP_FROM || 'noreply@simbazoo.ru'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

/**
 * Шаблон письма не равен сценарию кода: смену адреса подтверждают ДВА кода
 * одного сценария 'email_change', но уходят они на разные адреса и говорят
 * разное — владельцу аккаунта про смену, новому ящику про его подтверждение.
 */
export type OtpEmailTemplate = OtpPurpose | 'email_change_current'

/** Данные, без которых шаблон не может объяснить получателю, что происходит. */
export type OtpEmailContext = { newEmail?: string }

type RenderedEmail = { subject: string; text: string; html: string }

const TTL_NOTE = 'Код действителен 10 минут.'

/** Обычное письмо с кодом: строка-подводка и сам код. */
function renderCodeEmail(subject: string, lead: string, code: string): RenderedEmail {
  return {
    subject,
    text: `${lead}: ${code}\n\n${TTL_NOTE}`,
    html: `<p>${lead}: <strong>${code}</strong></p><p>${TTL_NOTE}</p>`,
  }
}

const EMAIL_TEMPLATES: Record<
  OtpEmailTemplate,
  (code: string, context: OtpEmailContext) => RenderedEmail
> = {
  login: (code) => renderCodeEmail('Ваш код входа в Симбу', 'Ваш код для входа', code),
  delete: (code) =>
    renderCodeEmail('Подтверждение удаления аккаунта', 'Код для подтверждения удаления аккаунта', code),
  email_change: (code) =>
    renderCodeEmail('Подтверждение нового адреса почты', 'Код для подтверждения нового адреса', code),

  /**
   * Письмо владельцу на ТЕКУЩИЙ адрес. Его код — согласие на передачу
   * аккаунта, поэтому одного кода мало: если сессию угнали, владелец должен
   * прочитать в письме, что адрес меняют и на какой, и понять, что код нельзя
   * никому пересылать.
   */
  email_change_current: (code, context) => {
    const target = context.newEmail ? `на ${context.newEmail}` : 'на другой адрес'
    const targetHtml = context.newEmail
      ? `на <strong>${escapeHtml(context.newEmail)}</strong>`
      : 'на другой адрес'

    return {
      subject: 'Запрошена смена адреса аккаунта',
      text:
        `Запрошена смена адреса аккаунта в Симбе ${target}.\n\n` +
        `Код подтверждения: ${code}\n\n` +
        `${TTL_NOTE}\n\n` +
        `Если вы этого не делали — никому не сообщайте код и напишите нам на ${SUPPORT_EMAIL}.`,
      html:
        `<p>Запрошена смена адреса аккаунта в Симбе ${targetHtml}.</p>` +
        `<p>Код подтверждения: <strong>${code}</strong></p>` +
        `<p>${TTL_NOTE}</p>` +
        '<p>Если вы этого не делали — никому не сообщайте код и напишите нам на ' +
        `<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`,
    }
  },
}

async function sendEmail(
  to: string,
  code: string,
  template: OtpEmailTemplate = 'login',
  context: OtpEmailContext = {}
): Promise<void> {
  // В test режиме письма не отправляются
  if (process.env.NODE_ENV === 'test') {
    return
  }

  const transporter = createTransport()

  const { subject, text, html } = EMAIL_TEMPLATES[template](code, context)

  await transporter.sendMail({
    from: SUPPORT_EMAIL,
    to,
    subject,
    text,
    html,
  })
}


/**
 * Письмо на ПРЕЖНИЙ адрес о том, что почта аккаунта сменилась. Единственный
 * канал, по которому владелец узнает о подмене, если доступ к почте перехвачен.
 */
async function sendEmailChangedNotice(to: string, newEmail: string): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    return
  }

  const transporter = createTransport()

  const subject = 'Адрес почты аккаунта изменён'
  const text =
    `Почта аккаунта в Симбе изменена на ${newEmail}.\n\n` +
    `Если это не вы — напишите нам на ${SUPPORT_EMAIL}, мы вернём доступ.`
  const html =
    `<p>Почта аккаунта в Симбе изменена на <strong>${escapeHtml(newEmail)}</strong>.</p>` +
    `<p>Если это не вы — напишите нам на <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>, ` +
    'мы вернём доступ.</p>'

  await transporter.sendMail({
    from: SUPPORT_EMAIL,
    to,
    subject,
    text,
    html,
  })
}

/**
 * Выпускает код под конкретный сценарий и адрес.
 *
 * purpose и target — не метаданные, а часть ключа проверки: код, ушедший на
 * неподтверждённый новый адрес, не должен работать как код входа.
 */
async function createOtp(
  prisma: PrismaClient,
  userId: string,
  channel: OtpChannel,
  purpose: OtpPurpose,
  target: string | null
): Promise<string> {
  const code = generateCode()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.otpCode.create({
    data: {
      userId,
      code: hashCode(code),
      channel,
      purpose,
      target,
      expiresAt,
    },
  })

  return code
}

/**
 * Ищет живой код под ОЖИДАЕМЫЙ сценарий и, если он задан, ожидаемый адрес —
 * НЕ гася его. Нужен там, где решение принимают два кода сразу: гасить первый
 * до проверки второго значило бы сжигать его при опечатке во втором.
 *
 * Код ищется сразу по хешу, а не «самый свежий, потом сравнить»: иначе вторая
 * открытая вкладка обесценивала бы код первой.
 */
async function findValidOtp(
  prisma: PrismaClient,
  userId: string,
  code: string,
  purpose: OtpPurpose,
  target?: string | null
): Promise<{ id: string } | null> {
  return prisma.otpCode.findFirst({
    where: {
      userId,
      purpose,
      code: hashCode(code),
      usedAt: null,
      expiresAt: { gt: new Date() },
      // target === null у кодов, выпущенных до появления поля: их адрес
      // неизвестен, и отвергать их значило бы оборвать вход всем, у кого код
      // уже в почте на момент выкатки.
      ...(target ? { OR: [{ target }, { target: null }] } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
}

const CONSUME_ABORTED = Symbol('otp-consume-aborted')

/**
 * Гасит коды по принципу «все или ни одного»: если хоть один уже погашен
 * параллельным запросом, транзакция откатывается и живыми остаются все.
 *
 * Условие usedAt: null стоит в самом запросе — два одновременных подтверждения
 * одним кодом не пройдут оба.
 */
async function consumeOtps(prisma: PrismaClient, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return false

  try {
    return await prisma.$transaction(async (tx) => {
      const usedAt = new Date()
      for (const id of ids) {
        const used = await tx.otpCode.updateMany({ where: { id, usedAt: null }, data: { usedAt } })
        if (used.count !== 1) throw CONSUME_ABORTED
      }
      return true
    })
  } catch (err) {
    if (err === CONSUME_ABORTED) return false
    throw err
  }
}

/** Проверяет код и сразу его гасит — для сценариев с одним кодом. */
async function verifyOtp(
  prisma: PrismaClient,
  userId: string,
  code: string,
  purpose: OtpPurpose,
  target?: string | null
): Promise<boolean> {
  const otp = await findValidOtp(prisma, userId, code, purpose, target)
  if (!otp) {
    return false
  }

  return consumeOtps(prisma, [otp.id])
}

export const otpService = {
  generateCode,
  hashCode,
  sendEmail,
  sendEmailChangedNotice,
  createOtp,
  findValidOtp,
  consumeOtps,
  verifyOtp,
}
