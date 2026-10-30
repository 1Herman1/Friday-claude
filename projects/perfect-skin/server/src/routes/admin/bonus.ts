import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { loyaltySettingsService } from '../../services/loyalty-settings.service.js'
import { bonusService } from '../../services/bonus.service.js'
import { getBonusAccount, listBonusAccounts } from '../../services/bonus-admin.service.js'
import { ApiError } from '../../lib/errors.js'
import { CONSENT_TEXT_VERSION } from '../../lib/consents.js'

const settingsBodySchema = z
  .object({
    enabled: z.boolean(),
    accrualPercent: z.number().int().min(0).max(100),
    accrualBase: z.enum(['paid_goods', 'after_promo', 'gross']),
    accrualTrigger: z.enum(['delivered', 'paid']),
    accrualDelayDays: z.number().int().min(0).max(60),
    excludeProfessionalProducts: z.boolean(),
    accrueWithPromo: z.boolean(),
    kopecksPerBonus: z.number().int().min(1).max(10000),
    maxSpendPercent: z.number().int().min(0).max(100),
    minOrderForSpend: z.number().int().min(0).max(10_000_000),
    allowSpendWithPromo: z.boolean(),
    bonusTtlDays: z.number().int().min(0).max(1825),
    refundMinTtlDays: z.number().int().min(1).max(365),
    welcomeBonus: z.number().int().min(0).max(5000),
    welcomeTtlDays: z.number().int().min(1).max(365),
    reviewBonus: z.number().int().min(0).max(2000),
    reviewTtlDays: z.number().int().min(1).max(365),
    expiryNoticeKind: z.enum(['service', 'advertising']),
    expiryNoticeDaysBefore: z.number().int().min(1).max(30),
    expectedUpdatedAt: z.string().datetime(),
  })
  .strict()

const accountsQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

const userIdParamSchema = z.object({ userId: z.string().uuid() })

const adjustmentBodySchema = z
  .object({
    amount: z
      .number()
      .int()
      .min(-100_000)
      .max(100_000)
      .refine((value) => value !== 0, 'amount must not be zero'),
    reason: z.string().trim().min(3).max(300),
    expiresInDays: z.number().int().min(1).max(1825).optional(),
    idempotencyKey: z.string().uuid(),
  })
  .refine((value) => value.expiresInDays === undefined || value.amount > 0, {
    message: 'expiresInDays only for positive amount',
    path: ['expiresInDays'],
  })

type Preset = Array<(request: FastifyRequest, reply: FastifyReply) => Promise<void>>

function invalid(field?: string): ApiError {
  return new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации', field ? { field } : undefined)
}

export async function bonusRoutes(app: FastifyInstance, viewPreHandlers: Preset, ownerPreHandlers: Preset) {
  // GET /api/v1/admin/bonus/settings — настройки и последние 20 изменений
  app.get(
    '/bonus/settings',
    {
      preHandler: viewPreHandlers,
      schema: {
        response: {
          200: { $ref: 'ps.adminBonusSettings#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.header('Cache-Control', 'no-store')
      reply.status(200).send(await loyaltySettingsService.getWithHistory())
    }
  )

  // PUT /api/v1/admin/bonus/settings — только super_admin; оптимистическая блокировка по expectedUpdatedAt
  app.put(
    '/bonus/settings',
    {
      preHandler: ownerPreHandlers,
      schema: {
        response: {
          200: { $ref: 'ps.adminBonusSettings#' },
          400: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      reply.header('Cache-Control', 'no-store')
      const parsed = settingsBodySchema.safeParse(request.body)
      if (!parsed.success) throw invalid(String(parsed.error.issues[0]?.path[0] ?? ''))

      const { expectedUpdatedAt, ...data } = parsed.data
      // Программу нельзя включить, пока правила Бьюти-клуба не утверждены (версия помечена draft)
      if (data.enabled && CONSENT_TEXT_VERSION.loyalty.endsWith('-draft')) {
        throw new ApiError(409, 'RULES_NOT_PUBLISHED', 'Правила Бьюти-клуба ещё не утверждены: программу нельзя включить')
      }

      const result = await loyaltySettingsService.update(data, new Date(expectedUpdatedAt), request.user!.id)
      reply.status(200).send(result)
    }
  )

  // GET /api/v1/admin/bonus/accounts — участники по email или телефону
  app.get<{ Querystring: { search?: string; limit?: string; offset?: string } }>(
    '/bonus/accounts',
    {
      preHandler: viewPreHandlers,
      schema: {
        response: {
          200: { $ref: 'ps.adminBonusAccountList#' },
          400: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { search?: string; limit?: string; offset?: string } }>, reply: FastifyReply) => {
      reply.header('Cache-Control', 'no-store')
      const parsed = accountsQuerySchema.safeParse(request.query)
      if (!parsed.success) throw invalid(String(parsed.error.issues[0]?.path[0] ?? ''))
      if (parsed.data.search !== undefined && parsed.data.search.length < 3) throw invalid('search')
      reply.status(200).send(await listBonusAccounts(parsed.data))
    }
  )

  // GET /api/v1/admin/bonus/accounts/:userId — счёт и история с причиной и автором
  app.get<{ Params: { userId: string }; Querystring: { limit?: string; offset?: string } }>(
    '/bonus/accounts/:userId',
    {
      preHandler: viewPreHandlers,
      schema: {
        response: {
          200: { $ref: 'ps.adminBonusAccountDetail#' },
          400: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { userId: string }; Querystring: { limit?: string; offset?: string } }>,
      reply: FastifyReply
    ) => {
      reply.header('Cache-Control', 'no-store')
      const params = userIdParamSchema.safeParse(request.params)
      if (!params.success) throw invalid('userId')
      const page = pageQuerySchema.safeParse(request.query)
      if (!page.success) throw invalid(String(page.error.issues[0]?.path[0] ?? ''))
      reply.status(200).send(await getBonusAccount(params.data.userId, page.data, new Date()))
    }
  )

  // POST /api/v1/admin/bonus/accounts/:userId/adjustments — ручная корректировка; 201 или 200 при повторе ключа
  app.post<{ Params: { userId: string }; Body: unknown }>(
    '/bonus/accounts/:userId/adjustments',
    {
      preHandler: viewPreHandlers,
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
          keyGenerator: (req: any) => req.user?.id ?? req.ip,
        },
      },
      schema: {
        response: {
          200: { $ref: 'ps.adminBonusAdjustment#' },
          201: { $ref: 'ps.adminBonusAdjustment#' },
          400: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { userId: string }; Body: unknown }>, reply: FastifyReply) => {
      reply.header('Cache-Control', 'no-store')
      const params = userIdParamSchema.safeParse(request.params)
      if (!params.success) throw invalid('userId')
      const body = adjustmentBodySchema.safeParse(request.body)
      if (!body.success) throw invalid(String(body.error.issues[0]?.path[0] ?? ''))

      const result = await bonusService.adjust({
        userId: params.data.userId,
        amount: body.data.amount,
        reason: body.data.reason,
        expiresInDays: body.data.expiresInDays ?? null,
        idempotencyKey: body.data.idempotencyKey,
        actorId: request.user!.id,
        now: new Date(),
      })
      request.log.info({ accountId: result.accountId, amount: body.data.amount, actorId: request.user!.id }, 'bonus manual adjustment')
      reply.status(result.replay ? 200 : 201).send({ transaction: result.transaction, balance: result.balance })
    }
  )
}
