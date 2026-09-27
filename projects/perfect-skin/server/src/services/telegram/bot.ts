import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { tgBotToken, publicUrl } from '../../lib/env.js'
import { reviewApplication } from '../pro-review.service.js'
import { createMailSender } from '../mail/index.js'
import { createTokenHash, crypto } from '../../lib/crypto.js'
import type { TelegramNotifier } from './notifier.js'

interface RejectState {
  applicantId: string
  ms: number
  expiresAt: Date
}

export class TelegramBot {
  private offset = 0
  private abortController: AbortController | null = null
  private rejectWaitingMap: Map<bigint, RejectState> = new Map()

  constructor(
    private prisma: PrismaClient,
    private app: FastifyInstance,
    private notifier: TelegramNotifier
  ) {}

  /**
   * Запустить поллер в фоне. Вызывается при старте сервера.
   */
  start(): void {
    if (!tgBotToken) {
      this.app.log.info('Telegram bot token not set, skipping bot startup')
      return
    }

    this.abortController = new AbortController()
    this.pollUpdates().catch((err) => {
      this.app.log.error(err, 'Bot polling error')
    })
  }

  /**
   * Остановить поллер при закрытии сервера.
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  private async pollUpdates(): Promise<void> {
    let backoffMs = 1000
    const maxBackoffMs = 60000

    while (this.abortController && !this.abortController.signal.aborted) {
      try {
        const updates = await this.getUpdates(this.offset, 50, 50)

        if (updates && updates.length > 0) {
          for (const update of updates) {
            await this.handleUpdate(update)
            this.offset = Math.max(this.offset, update.update_id + 1)
          }
          backoffMs = 1000 // Reset на успехе
        }
      } catch (err) {
        this.app.log.warn({ error: err }, 'Polling error, backing off')
        backoffMs = Math.min(backoffMs * 2, maxBackoffMs)
        // Ждём перед повтором
        await new Promise((resolve) => setTimeout(resolve, backoffMs))
      }
    }
  }

  private async getUpdates(offset: number, limit: number, timeout: number): Promise<any[]> {
    const controller = new AbortController()
    const timeoutHandle = setTimeout(() => controller.abort(), (timeout + 10) * 1000)

    try {
      const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/getUpdates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offset, limit, timeout }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`)
      }

      const data = await response.json() as any
      return data?.ok ? data.result : []
    } finally {
      clearTimeout(timeoutHandle)
    }
  }

  private async handleUpdate(update: any): Promise<void> {
    const message = update?.message
    const callbackQuery = update?.callback_query

    if (message && message.chat?.type === 'private') {
      if (message.text?.startsWith('/start ')) {
        await this.handleStart(message)
      } else if (message.text && !message.text.startsWith('/')) {
        // Текстовое сообщение — возможно ответ на отклонение
        await this.handleRejectReason(message)
      } else if (!message.text?.startsWith('/start')) {
        // Любое другое сообщение от непривязанного чата
        await this.answerText(message.chat.id, 'Бот для сотрудников магазина')
      }
    }

    if (callbackQuery) {
      await this.handleCallback(callbackQuery)
    }
  }

  private async handleStart(message: any): Promise<void> {
    const chatId = message.from.id
    const parts = message.text.split(' ')
    const code = parts[1]

    if (!code || code.length !== 8) {
      await this.answerText(chatId, 'Код не подошёл, получите новый в админке')
      return
    }

    try {
      const codeHash = await createTokenHash(code)
      const linkCode = await this.prisma.telegramLinkCode.findUnique({
        where: { codeHash },
        select: { userId: true, expiresAt: true, usedAt: true },
      })

      if (!linkCode || linkCode.usedAt || linkCode.expiresAt < new Date()) {
        await this.answerText(chatId, 'Код не подошёл, получите новый в админке')
        return
      }

      // Проверяем что владелец кода — активный сотрудник с нужной ролью
      const staffRoles = ['super_admin', 'orders_manager', 'products_manager', 'content_manager']
      const user = await this.prisma.user.findUnique({
        where: { id: linkCode.userId },
        select: { role: true, isActive: true },
      })

      if (!user || !user.isActive || !staffRoles.includes(user.role)) {
        await this.answerText(chatId, 'Код не подошёл, получите новый в админке')
        return
      }

      // Привязываем или перепривязываем
      await this.prisma.telegramLink.upsert({
        where: { userId: linkCode.userId },
        create: { userId: linkCode.userId, chatId: BigInt(chatId) },
        update: { chatId: BigInt(chatId), linkedAt: new Date() },
      })

      // Отмечаем код как использованный
      await this.prisma.telegramLinkCode.update({
        where: { codeHash },
        data: { usedAt: new Date() },
      })

      await this.answerText(chatId, 'Готово. Сюда будут приходить заявки специалистов')
    } catch (err) {
      this.app.log.warn({ chatId, error: err }, 'Start command error')
      await this.answerText(chatId, 'Ошибка, попробуйте позже')
    }
  }

  private async handleCallback(callbackQuery: any): Promise<void> {
    const chatId = callbackQuery.from?.id
    const data = callbackQuery.data as string
    const queryId = callbackQuery.id

    // Проверяем доступ: привязан ли чат, активен ли пользователь, есть ли роль
    const link = await this.prisma.telegramLink.findUnique({
      where: { chatId: BigInt(chatId) },
      select: { userId: true },
    })

    if (!link) {
      await this.answerCallbackQuery(queryId, 'Нет доступа')
      return
    }

    const staffRoles = ['super_admin', 'orders_manager', 'products_manager', 'content_manager']
    const user = await this.prisma.user.findUnique({
      where: { id: link.userId },
      select: { role: true, isActive: true },
    })

    if (!user || !user.isActive || !staffRoles.includes(user.role)) {
      await this.answerCallbackQuery(queryId, 'Нет доступа')
      return
    }

    try {
      if (data && typeof data === 'string') {
        if (data.startsWith('v:')) {
          await this.handleViewCallback(chatId, queryId, data, link.userId)
        } else if (data.startsWith('a:')) {
          await this.handleApproveCallback(chatId, queryId, data, link.userId)
        } else if (data.startsWith('r:')) {
          await this.handleRejectCallback(chatId, queryId, data, link.userId)
        }
      }
    } catch (err) {
      this.app.log.warn({ chatId, data, error: err }, 'Callback error')
      await this.answerCallbackQuery(queryId, 'Ошибка')
    }
  }

  private async handleViewCallback(chatId: bigint, queryId: string, data: string, reviewerId: string): Promise<void> {
    const applicantId = data.slice(2)

    if (!this.isValidUuid(applicantId)) {
      await this.answerCallbackQuery(queryId, 'ID невалиден')
      return
    }

    if (!publicUrl) {
      await this.answerCallbackQuery(queryId, 'Адрес сайта не настроен')
      return
    }

    try {
      // Создаём одноразовый токен для просмотра
      const token = crypto.randomBytes(32).toString('base64url')
      const tokenHash = await createTokenHash(token)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 минут

      await this.prisma.docViewToken.create({
        data: {
          tokenHash,
          applicantId,
          staffUserId: reviewerId,
          expiresAt,
        },
      })

      const url = `${publicUrl}/api/v1/review/${token}`
      const text = `Открыть заявку (ссылка на 10 минут)`

      await this.sendMessage(chatId, text, [[{ text, url }]])
      await this.answerCallbackQuery(queryId, 'Ссылка отправлена')
    } catch (err) {
      this.app.log.warn({ chatId, applicantId, error: err }, 'View callback error')
      await this.answerCallbackQuery(queryId, 'Ошибка')
    }
  }

  private async handleApproveCallback(chatId: bigint, queryId: string, data: string, reviewerId: string): Promise<void> {
    const parts = data.split(':')
    if (parts.length !== 3) {
      await this.answerCallbackQuery(queryId, 'Данные невалидны')
      return
    }

    const applicantId = parts[1]
    const ms = parseInt(parts[2], 10)

    if (!this.isValidUuid(applicantId) || isNaN(ms)) {
      await this.answerCallbackQuery(queryId, 'Данные невалидны')
      return
    }

    try {
      const mailSender = createMailSender()
      const expectedRequestedAt = new Date(ms).toISOString()

      await reviewApplication(this.prisma, {
        applicantId,
        action: 'approve',
        expectedRequestedAt,
        reviewerId,
        via: 'telegram',
      }, mailSender, this.notifier)

      await this.answerCallbackQuery(queryId, 'Одобрено')
    } catch (err: any) {
      if (err.code === 'PRO_REQUEST_CHANGED') {
        await this.answerCallbackQuery(queryId, 'Заявка изменилась — откройте её заново')
      } else if (err.code === 'PRO_INN_TAKEN') {
        await this.answerCallbackQuery(queryId, err.message)
      } else {
        this.app.log.warn({ chatId, applicantId, error: err }, 'Approve callback error')
        await this.answerCallbackQuery(queryId, 'Ошибка')
      }
    }
  }

  private async handleRejectCallback(chatId: bigint, queryId: string, data: string, reviewerId: string): Promise<void> {
    const parts = data.split(':')
    if (parts.length !== 3) {
      await this.answerCallbackQuery(queryId, 'Данные невалидны')
      return
    }

    const applicantId = parts[1]
    const ms = parseInt(parts[2], 10)

    if (!this.isValidUuid(applicantId) || isNaN(ms)) {
      await this.answerCallbackQuery(queryId, 'Данные невалидны')
      return
    }

    try {
      // Запоминаем ожидание ввода причины
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
      this.rejectWaitingMap.set(chatId, { applicantId, ms, expiresAt })

      // Отправляем сообщение с force_reply
      await this.sendMessage(chatId, 'Напишите причину отказа одним сообщением', [], true)
      await this.answerCallbackQuery(queryId, 'Введите причину')
    } catch (err) {
      this.app.log.warn({ chatId, applicantId, error: err }, 'Reject callback error')
      await this.answerCallbackQuery(queryId, 'Ошибка')
    }
  }

  private async handleRejectReason(message: any): Promise<void> {
    const chatId = BigInt(message.from.id)
    const text = message.text?.trim() || ''

    if (text.length < 2 || text.length > 500) {
      await this.answerText(chatId, 'Причина должна быть от 2 до 500 символов')
      return
    }

    const state = this.rejectWaitingMap.get(chatId)
    if (!state) {
      return
    }

    // Проверяем истечение
    if (state.expiresAt < new Date()) {
      this.rejectWaitingMap.delete(chatId)
      await this.answerText(chatId, 'Время ввода истекло, нажмите Отклонить заново')
      return
    }

    try {
      const link = await this.prisma.telegramLink.findUnique({
        where: { chatId },
        select: { userId: true },
      })

      if (!link) {
        await this.answerText(chatId, 'Нет доступа')
        return
      }

      const mailSender = createMailSender()
      const expectedRequestedAt = new Date(state.ms).toISOString()

      await reviewApplication(this.prisma, {
        applicantId: state.applicantId,
        action: 'reject',
        reason: text,
        expectedRequestedAt,
        reviewerId: link.userId,
        via: 'telegram',
      }, mailSender, this.notifier)

      this.rejectWaitingMap.delete(chatId)
      await this.answerText(chatId, 'Отклонено')
    } catch (err: any) {
      if (err.code === 'PRO_REQUEST_CHANGED') {
        await this.answerText(chatId, 'Заявка изменилась — откройте её заново')
      } else {
        this.app.log.warn({ chatId, error: err }, 'Reject reason error')
        await this.answerText(chatId, 'Ошибка')
      }
    }
  }

  private async answerText(chatId: bigint, text: string): Promise<void> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId.toString(), text }),
      })

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`)
      }
    } catch (err) {
      this.app.log.warn({ chatId, error: err }, 'Failed to send text message')
    }
  }

  private async sendMessage(chatId: bigint, text: string, buttons: any[], forceReply = false): Promise<void> {
    try {
      const payload: any = {
        chat_id: chatId.toString(),
        text,
      }

      if (buttons.length > 0) {
        payload.reply_markup = { inline_keyboard: buttons }
      }

      if (forceReply) {
        payload.reply_markup = { force_reply: true, selective: true }
      }

      const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`)
      }
    } catch (err) {
      this.app.log.warn({ chatId, error: err }, 'Failed to send message')
    }
  }

  private async answerCallbackQuery(queryId: string, text: string): Promise<void> {
    try {
      await fetch(`https://api.telegram.org/bot${tgBotToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: queryId, text }),
      })
    } catch (err) {
      this.app.log.warn({ queryId, error: err }, 'Failed to answer callback query')
    }
  }

  private isValidUuid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  }
}

export function createTelegramBot(prisma: PrismaClient, app: FastifyInstance, notifier: TelegramNotifier): TelegramBot {
  return new TelegramBot(prisma, app, notifier)
}
