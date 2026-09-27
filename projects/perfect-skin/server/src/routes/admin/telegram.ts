import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ApiError } from '../../lib/errors.js'
import { createTokenHash, generateLinkCode } from '../../lib/crypto.js'

export async function telegramRoutes(app: FastifyInstance, preHandlers: any[]) {
  // POST /api/v1/admin/telegram/link-code
  app.post(
    '/telegram/link-code',
    {
      preHandler: preHandlers,
      schema: {
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

      // Удаляем старые неиспользованные коды этого сотрудника
      await app.prisma.telegramLinkCode.deleteMany({
        where: {
          userId,
          usedAt: null,
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
        },
      })

      // Получаем имя бота для ссылки
      const { tgBotUsername } = await import('../../lib/env.js')
      const deepLink = tgBotUsername ? `https://t.me/${tgBotUsername}?start=${code}` : null

      reply.status(200).send({
        code,
        deepLink,
        expiresAt: expiresAt.toISOString(),
      })
    }
  )

  // GET /api/v1/admin/telegram/link
  app.get(
    '/telegram/link',
    {
      preHandler: preHandlers,
      schema: {
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

      const link = await app.prisma.telegramLink.findUnique({
        where: { userId },
        select: { linkedAt: true },
      })

      reply.status(200).send({
        linked: !!link,
        linkedAt: link ? link.linkedAt.toISOString() : null,
      })
    }
  )

  // DELETE /api/v1/admin/telegram/link
  app.delete(
    '/telegram/link',
    {
      preHandler: preHandlers,
      schema: {
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

      await app.prisma.telegramLink.deleteMany({
        where: { userId },
      })

      reply.status(204).send()
    }
  )
}
