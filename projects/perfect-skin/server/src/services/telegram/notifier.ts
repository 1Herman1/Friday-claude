import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { publicUrl, tgBotToken } from '../../lib/env.js'
import { PRO_REVIEW_ROLES } from '../../lib/pricing.js'

export class TelegramNotifier {
  constructor(
    private prisma: PrismaClient,
    private app: FastifyInstance
  ) {}

  /**
   * Отправить уведомление о новой заявке всем привязанным сотрудникам.
   * Не блокирует ответ, ошибки логируются как warning.
   */
  async onNewApplication(applicantId: string): Promise<void> {
    if (!tgBotToken) {
      return
    }

    try {
      // Получаем заявку
      const applicant = await this.prisma.user.findUnique({
        where: { id: applicantId },
        select: {
          inn: true,
          companyName: true,
          proRequestedAt: true,
          proCheck: true,
        },
      })

      if (!applicant || !applicant.proRequestedAt) {
        return
      }

      // Получаем активных сотрудников с нужными ролями
      const links = await this.prisma.telegramLink.findMany({
        select: { userId: true, chatId: true },
      })

      // Проверяем каждого на активность и роль
      for (const link of links) {
        const user = await this.prisma.user.findUnique({
          where: { id: link.userId },
          select: { role: true, isActive: true },
        })

        if (!user || !user.isActive || !PRO_REVIEW_ROLES.includes(user.role)) {
          continue
        }

        // Строим текст уведомления
        const registryText = (applicant.proCheck as { lane?: string } | null)?.lane === 'green' ? '✓ найден в реестре МСП' : 'Нет в реестре — проверить внимательно'
        const priorityLine = `Приоритет: ${registryText}`

        let duplicatesLine = ''
        if (applicant.inn) {
          const pending = await this.prisma.user.count({
            where: { inn: applicant.inn, deletedAt: null, proStatus: 'pending' },
          })
          const approved = await this.prisma.user.count({
            where: { inn: applicant.inn, deletedAt: null, proStatus: 'approved' },
          })
          const totalDuplicates = pending + approved
          if (totalDuplicates > 0) {
            duplicatesLine = `\nЭтот ИНН заявлен ещё: ${pending} / уже одобрен: ${approved}`
          }
        }

        const queueCount = await this.prisma.user.count({
          where: { proStatus: 'pending' },
        })
        const queueLine = `В очереди на проверке: ${queueCount}`

        const text = `Новая заявка специалиста\n${priorityLine}${duplicatesLine}\n${queueLine}`

        // Кнопки
        const buttons = [
          [{ text: 'Открыть заявку', callback_data: `v:${applicantId}` }],
          [
            { text: 'Одобрить', callback_data: `a:${applicantId}:${applicant.proRequestedAt.getTime()}` },
            { text: 'Отклонить', callback_data: `r:${applicantId}:${applicant.proRequestedAt.getTime()}` },
          ],
        ]

        if (publicUrl) {
          buttons.push([{ text: 'Админка', url: `${publicUrl}/admin/pro-requests` } as any])
        }

        try {
          const response = await this.sendMessage(link.chatId, text, buttons)
          if (response && response.ok && response.result?.message_id) {
            // Сохраняем в БД
            await this.prisma.telegramNotice.create({
              data: {
                applicantId,
                chatId: link.chatId,
                messageId: response.result.message_id,
              },
            })
          }
        } catch (err) {
          this.app.log.warn({ chatId: link.chatId, applicantId, error: err }, 'Failed to send Telegram notification')
        }
      }
    } catch (err) {
      this.app.log.warn({ applicantId, error: err }, 'Failed to send new application notifications')
    }
  }

  /**
   * Отправить уведомление о новой заявке на консультацию всем привязанным сотрудникам.
   */
  async onNewConsultation(consultationId: string): Promise<void> {
    if (!tgBotToken) {
      return
    }

    try {
      // Получаем заявку на консультацию
      const consultation = await this.prisma.consultationRequest.findUnique({
        where: { id: consultationId },
        select: {
          channel: true,
          createdAt: true,
        },
      })

      if (!consultation) {
        return
      }

      // Получаем активных сотрудников с нужными ролями
      const links = await this.prisma.telegramLink.findMany({
        select: { userId: true, chatId: true },
      })

      // Проверяем каждого на активность и роль
      for (const link of links) {
        const user = await this.prisma.user.findUnique({
          where: { id: link.userId },
          select: { role: true, isActive: true },
        })

        if (!user || !user.isActive || !PRO_REVIEW_ROLES.includes(user.role)) {
          continue
        }

        // Получаем количество заявок в очереди
        const queueCount = await this.prisma.consultationRequest.count({
          where: { status: 'new' },
        })

        const channelLabel = consultation.channel === 'phone' ? 'Телефон' : consultation.channel === 'telegram' ? 'Telegram' : 'WhatsApp'
        const text = `Новая заявка на консультацию\nКанал: ${channelLabel}\nНовых в очереди: ${queueCount}`

        // Кнопка для открытия админки
        const buttons = publicUrl ? [[{ text: 'Перейти в админку', url: `${publicUrl}/admin/consultations` }]] : []

        try {
          await this.sendMessage(link.chatId, text, buttons)
        } catch (err) {
          this.app.log.warn({ chatId: link.chatId, consultationId, error: err }, 'Failed to send Telegram consultation notification')
        }
      }
    } catch (err) {
      this.app.log.warn({ consultationId, error: err }, 'Failed to send new consultation notifications')
    }
  }

  /**
   * Отредактировать все сообщения по заявке — указать решение.
   */
  async onDecision(applicantId: string, status: string, reviewerName: string): Promise<void> {
    if (!tgBotToken) {
      return
    }

    try {
      const notices = await this.prisma.telegramNotice.findMany({
        where: { applicantId },
        select: { chatId: true, messageId: true },
      })

      const statusText = status === 'approved' ? '— одобрена' : '— отклонена'
      const text = `Заявка специалиста ${statusText} (${reviewerName})`

      for (const notice of notices) {
        try {
          await this.editMessage(notice.chatId, notice.messageId, text, [])
        } catch (err) {
          // Сообщение удалено или старше лимита — игнорируем
          this.app.log.debug({ chatId: notice.chatId, messageId: notice.messageId, error: err }, 'Failed to edit Telegram message')
        }
      }
    } catch (err) {
      this.app.log.warn({ applicantId, error: err }, 'Failed to update decision notifications')
    }
  }

  private async sendMessage(chatId: bigint, text: string, buttons: any[]) {
    const payload = {
      chat_id: chatId.toString(),
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    }

    const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`)
    }

    return await response.json() as any
  }

  private async editMessage(chatId: bigint, messageId: number, text: string, buttons: any[]) {
    const payload = {
      chat_id: chatId.toString(),
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined,
    }

    const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`)
    }

    return await response.json() as any
  }
}

export function createTelegramNotifier(prisma: PrismaClient, app: FastifyInstance): TelegramNotifier {
  return new TelegramNotifier(prisma, app)
}
