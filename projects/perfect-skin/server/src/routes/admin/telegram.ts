import type { FastifyInstance } from 'fastify'
import { TelegramBotKind } from '../../lib/db.js'
import { z } from 'zod'
import { ApiError } from '../../lib/errors.js'
import { createTokenHash, generateLinkCode } from '../../lib/crypto.js'
import { PRO_REVIEW_ROLES } from '../../lib/pricing.js'

export async function telegramRoutes(app: FastifyInstance, preHandlers: any[]) {
  // POST /api/v1/admin/telegram/link-code
  app.post(
    '/telegram/link-code',
    {
      preHandler: preHandlers,
      schema: {
        body: {
          type: 'object',
          required: ['botKind'],
          properties: {
            botKind: { type: 'string', enum: ['pro', 'orders'] },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['code', 'expiresAt'],
            properties: {
              code: { type: 'string' },
              deepLink: { type: ['string', 'null'] },
              expiresAt: { type: 'string', format: 'date-time' },
            },
          },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const { botKind } = request.body as { botKind: string }

      // Проверяем права по типу бота
      const user = await app.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      })

      if (!user) {
        throw new ApiError(403, 'FORBIDDEN', 'Пользователь не найден')
      }

      // Для про-бота: нужна роль из PRO_REVIEW_ROLES
      // Для заказов-бота: нужна роль super_admin или orders_manager
      if (botKind === 'pro') {
        if (!PRO_REVIEW_ROLES.includes(user.role)) {
          throw new ApiError(403, 'FORBIDDEN', 'Нет прав для генерации кода про-бота')
        }
      } else if (botKind === 'orders') {
        if (!['super_admin', 'orders_manager'].includes(user.role)) {
          throw new ApiError(403, 'FORBIDDEN', 'Нет прав для генерации кода бота заказов')
        }
      }

      // Удаляем старые неиспользованные коды этого сотрудника для этого типа бота
      await app.prisma.telegramLinkCode.deleteMany({
        where: {
          userId,
          usedAt: null,
          botKind: botKind === 'pro' ? TelegramBotKind.pro : TelegramBotKind.orders,
        },
      })

      // Генерируем новый код
      const code = generateLinkCode()
      const codeHash = await createTokenHash(code)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 минут

      await app.prisma.telegramLinkCode.create({
        data: {
          codeHash,
          userId,
          expiresAt,
          botKind: botKind === 'pro' ? TelegramBotKind.pro : TelegramBotKind.orders,
        },
      })

      // Получаем имя бота для ссылки
      const { tgBotUsername, tgOrdersBotUsername } = await import('../../lib/env.js')
      const botUsername = botKind === 'pro' ? tgBotUsername : tgOrdersBotUsername
      const deepLink = botUsername ? `https://t.me/${botUsername}?start=${code}` : null

      reply.status(200).send({
        code,
        deepLink,
        expiresAt: expiresAt.toISOString(),
      })
    }
  )

  // GET /api/v1/admin/telegram/link/:botKind
  app.get(
    '/telegram/link/:botKind',
    {
      preHandler: preHandlers,
      schema: {
        params: {
          type: 'object',
          required: ['botKind'],
          properties: {
            botKind: { type: 'string', enum: ['pro', 'orders'] },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['linked'],
            properties: {
              linked: { type: 'boolean' },
              linkedAt: { type: ['string', 'null'], format: 'date-time' },
            },
          },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const { botKind } = request.params as { botKind: string }

      const link = await app.prisma.telegramLink.findUnique({
        where: { userId_botKind: { userId, botKind: botKind === 'pro' ? TelegramBotKind.pro : TelegramBotKind.orders } },
        select: { linkedAt: true },
      })

      reply.status(200).send({
        linked: !!link,
        linkedAt: link ? link.linkedAt.toISOString() : null,
      })
    }
  )

  // DELETE /api/v1/admin/telegram/link/:botKind
  app.delete(
    '/telegram/link/:botKind',
    {
      preHandler: preHandlers,
      schema: {
        params: {
          type: 'object',
          required: ['botKind'],
          properties: {
            botKind: { type: 'string', enum: ['pro', 'orders'] },
          },
        },
        response: {
          204: {
            type: 'null',
          },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const { botKind } = request.params as { botKind: string }

      await app.prisma.telegramLink.deleteMany({
        where: {
          userId,
          botKind: botKind === 'pro' ? TelegramBotKind.pro : TelegramBotKind.orders,
        },
      })

      reply.status(204).send()
    }
  )
}
