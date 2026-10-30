import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import prismaPlugin from '../plugins/prisma.js'
import authenticatePlugin from '../plugins/authenticate.js'
import { ApiError, errorResponse } from '../lib/errors.js'
import { registerCommonSchemas } from '../schemas/common.js'
import adminRoutes from '../routes/admin/index.js'
import { db, $Enums } from '../lib/db.js'

const { sign } = jwt
const MAIL_DOMAIN = '@ps-bonus-test.local'
const RUN = crypto.randomUUID().slice(0, 8)
const DAY_MS = 86_400_000

let app: FastifyInstance
let original: Record<string, unknown>

async function build(): Promise<FastifyInstance> {
  const server = Fastify()
  registerCommonSchemas(server)
  await server.register(prismaPlugin)
  await server.register(cookie, { secret: process.env.PS_COOKIE_SECRET || 'test-secret', hook: 'preHandler' })
  await server.register(cors, { origin: 'http://localhost:3000', credentials: true })
  await server.register(rateLimit, { max: 10000, timeWindow: '1 minute' })
  await server.register(authenticatePlugin)
  server.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send(errorResponse(error))
    if ((error as { validation?: unknown }).validation) {
      return reply.status(400).send(errorResponse(new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')))
    }
    console.error('ТЕСТ-500:', error)
    reply.status(500).send(errorResponse(new ApiError(500, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера')))
  })
  await server.register(adminRoutes)
  return server
}

async function staff(role: $Enums.UserRole, label: string = role): Promise<string> {
  const user = await db.user.create({
    data: { email: `bonus-admin-${label}-${RUN}${MAIL_DOMAIN}`, name: `Сотрудник ${label}`, role },
  })
  return sign({ userId: user.id, role: user.role, tv: user.tokenVersion }, process.env.JWT_SECRET || 'dev-secret')
}

function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` }
}

async function makeCustomer(label: string, balance: number) {
  const user = await db.user.create({
    data: { email: `${label}-${RUN}${MAIL_DOMAIN}`, name: `Покупатель ${label}`, role: 'customer' },
  })
  const account = await db.bonusAccount.create({ data: { userId: user.id, balance } })
  if (balance > 0) {
    await db.bonusTransaction.create({
      data: { accountId: account.id, type: 'welcome', amount: balance, remaining: balance, expiresAt: null },
    })
  }
  return { user, account }
}

async function cleanup(): Promise<void> {
  const users = await db.user.findMany({ where: { email: { endsWith: MAIL_DOMAIN } }, select: { id: true } })
  const userIds = users.map((u) => u.id)
  if (userIds.length === 0) return
  const accounts = await db.bonusAccount.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
  await db.bonusTransaction.deleteMany({ where: { accountId: { in: accounts.map((a) => a.id) } } })
  await db.bonusAccount.deleteMany({ where: { id: { in: accounts.map((a) => a.id) } } })
  await db.loyaltySettingsChange.deleteMany({ where: { changedById: { in: userIds } } })
  await db.loyaltySettings.updateMany({ where: { updatedById: { in: userIds } }, data: { updatedById: null } })
  await db.consentRecord.deleteMany({ where: { userId: { in: userIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
}

async function settingsBody(): Promise<Record<string, unknown>> {
  const res = await app.inject({ method: 'GET', url: '/api/v1/admin/bonus/settings', headers: bearer(superToken) })
  const { settings } = JSON.parse(res.body)
  const { updatedAt, updatedBy, ...fields } = settings
  return { ...fields, expectedUpdatedAt: updatedAt }
}

let superToken = ''

describe('Бонусы: админка — настройки, права, корректировки (HTTP)', () => {
  beforeAll(async () => {
    app = await build()
    await cleanup()
    original = await db.loyaltySettings.findUniqueOrThrow({ where: { id: 1 } })
    superToken = await staff('super_admin', 'super')
  })

  afterAll(async () => {
    await cleanup()
    const { id, createdAt, updatedAt, updatedById, ...fields } = original as Record<string, unknown> & {
      id: number
      createdAt: Date
      updatedAt: Date
      updatedById: string | null
    }
    await db.loyaltySettings.update({ where: { id: 1 }, data: { ...fields, updatedById: null } })
    await app.close()
  })

  it('по умолчанию в схеме программа выключена', async () => {
    const rows = await db.$queryRaw<{ column_default: string }[]>`
      SELECT column_default FROM information_schema.columns
      WHERE table_name = 'loyalty_settings' AND column_name = 'enabled'`
    expect(rows[0]?.column_default).toBe('false')
  })

  it('права: покупатель и контент-менеджер — 403; заказы-менеджер читает и корректирует, но не пишет настройки', async () => {
    const customer = await staff('customer', 'customer-rights')
    const content = await staff('content_manager', 'content-rights')
    const orders = await staff('orders_manager', 'orders-rights')
    const { user } = await makeCustomer('rights-target', 100)

    for (const token of [customer, content]) {
      expect((await app.inject({ method: 'GET', url: '/api/v1/admin/bonus/settings', headers: bearer(token) })).statusCode).toBe(403)
      expect((await app.inject({ method: 'GET', url: '/api/v1/admin/bonus/accounts', headers: bearer(token) })).statusCode).toBe(403)
      expect(
        (await app.inject({
          method: 'POST',
          url: `/api/v1/admin/bonus/accounts/${user.id}/adjustments`,
          payload: { amount: 1, reason: 'проверка прав', idempotencyKey: crypto.randomUUID() },
          headers: bearer(token),
        })).statusCode
      ).toBe(403)
    }

    expect((await app.inject({ method: 'GET', url: '/api/v1/admin/bonus/settings', headers: bearer(orders) })).statusCode).toBe(200)
    expect((await app.inject({ method: 'PUT', url: '/api/v1/admin/bonus/settings', payload: await settingsBody(), headers: bearer(orders) })).statusCode).toBe(403)
    const adjust = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/bonus/accounts/${user.id}/adjustments`,
      payload: { amount: 5, reason: 'проверка прав', idempotencyKey: crypto.randomUUID() },
      headers: bearer(orders),
    })
    expect(adjust.statusCode).toBe(201)
  })

  it('PUT: устаревший expectedUpdatedAt → 409; успешная запись попадает в журнал с до/после и автором', async () => {
    const body = await settingsBody()
    const stale = { ...body, expectedUpdatedAt: new Date(Date.now() - DAY_MS).toISOString() }
    const conflict = await app.inject({ method: 'PUT', url: '/api/v1/admin/bonus/settings', payload: stale, headers: bearer(superToken) })
    expect(conflict.statusCode).toBe(409)
    expect(JSON.parse(conflict.body).error.code).toBe('SETTINGS_CONFLICT')

    const fresh = await settingsBody()
    const next = { ...fresh, expiryNoticeDaysBefore: fresh.expiryNoticeDaysBefore === 7 ? 8 : 7 }
    const ok = await app.inject({ method: 'PUT', url: '/api/v1/admin/bonus/settings', payload: next, headers: bearer(superToken) })
    expect(ok.statusCode).toBe(200)
    const result = JSON.parse(ok.body)
    expect(result.settings.expiryNoticeDaysBefore).toBe(next.expiryNoticeDaysBefore)
    const change = result.changes[0]
    expect(change.before.expiryNoticeDaysBefore).toBe(fresh.expiryNoticeDaysBefore)
    expect(change.after.expiryNoticeDaysBefore).toBe(next.expiryNoticeDaysBefore)
    expect(change.changedBy.name).toBe('Сотрудник super')
  })

  it('PUT со строгой схемой: лишнее поле → 400', async () => {
    const body = { ...(await settingsBody()), unknownField: 1 }
    const res = await app.inject({ method: 'PUT', url: '/api/v1/admin/bonus/settings', payload: body, headers: bearer(superToken) })
    expect(res.statusCode).toBe(400)
  })

  it('начисление по оплате с задержкой меньше 14 дней → 422, настройки не меняются', async () => {
    const before = await db.loyaltySettings.findUniqueOrThrow({ where: { id: 1 } })
    const body = { ...(await settingsBody()), accrualTrigger: 'paid', accrualDelayDays: 13 }

    const res = await app.inject({ method: 'PUT', url: '/api/v1/admin/bonus/settings', payload: body, headers: bearer(superToken) })

    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body).error.code).toBe('ACCRUAL_PAID_DELAY_TOO_SHORT')
    const after = await db.loyaltySettings.findUniqueOrThrow({ where: { id: 1 } })
    expect(after.accrualTrigger).toBe(before.accrualTrigger)
    expect(after.accrualDelayDays).toBe(before.accrualDelayDays)
    expect(after.updatedAt).toEqual(before.updatedAt)
  })

  it('начисление по оплате с задержкой 14 дней проходит; правило не мешает начислению по доставке', async () => {
    try {
      const paid = { ...(await settingsBody()), accrualTrigger: 'paid', accrualDelayDays: 14 }
      const ok = await app.inject({ method: 'PUT', url: '/api/v1/admin/bonus/settings', payload: paid, headers: bearer(superToken) })
      expect(ok.statusCode).toBe(200)

      const delivered = { ...(await settingsBody()), accrualTrigger: 'delivered', accrualDelayDays: 0 }
      const back = await app.inject({ method: 'PUT', url: '/api/v1/admin/bonus/settings', payload: delivered, headers: bearer(superToken) })
      expect(back.statusCode).toBe(200)
    } finally {
      await db.loyaltySettings.update({ where: { id: 1 }, data: { accrualTrigger: original.accrualTrigger as $Enums.BonusAccrualTrigger, accrualDelayDays: original.accrualDelayDays as number } })
    }
  })

  it('программу нельзя включить, пока версия правил помечена draft', async () => {
    const body = { ...(await settingsBody()), enabled: true }
    const res = await app.inject({ method: 'PUT', url: '/api/v1/admin/bonus/settings', payload: body, headers: bearer(superToken) })

    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body).error.code).toBe('RULES_NOT_PUBLISHED')
    expect((await db.loyaltySettings.findUniqueOrThrow({ where: { id: 1 } })).enabled).toBe(false)
  })

  it('корректировка «+»: причина и автор в журнале, срок по запросу; ответ 201', async () => {
    const { user, account } = await makeCustomer('adjust-plus', 10)
    const key = crypto.randomUUID()

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/bonus/accounts/${user.id}/adjustments`,
      payload: { amount: 50, reason: 'компенсация за задержку', expiresInDays: 30, idempotencyKey: key },
      headers: bearer(superToken),
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.balance).toBe(60)
    expect(body.transaction).toMatchObject({ type: 'manual_adjustment', amount: 50, reason: 'компенсация за задержку' })
    expect(body.transaction.createdBy).toMatchObject({ name: 'Сотрудник super' })
    const row = await db.bonusTransaction.findUniqueOrThrow({ where: { idempotencyKey: `manual:${key}` } })
    expect(row.accountId).toBe(account.id)
    expect(row.createdById).not.toBeNull()
    expect(row.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 29 * DAY_MS)
  })

  it('корректировка «−»: больше баланса → 409 BONUS_INSUFFICIENT; в пределах → списание; срок для минуса → 400', async () => {
    const { user } = await makeCustomer('adjust-minus', 30)

    const tooMuch = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/bonus/accounts/${user.id}/adjustments`,
      payload: { amount: -31, reason: 'списание сверх баланса', idempotencyKey: crypto.randomUUID() },
      headers: bearer(superToken),
    })
    expect(tooMuch.statusCode).toBe(409)
    expect(JSON.parse(tooMuch.body)).toMatchObject({ error: { code: 'BONUS_INSUFFICIENT', details: { available: 30 } } })

    const ok = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/bonus/accounts/${user.id}/adjustments`,
      payload: { amount: -10, reason: 'ошибочное начисление', idempotencyKey: crypto.randomUUID() },
      headers: bearer(superToken),
    })
    expect(ok.statusCode).toBe(201)
    expect(JSON.parse(ok.body).balance).toBe(20)

    const badExpiry = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/bonus/accounts/${user.id}/adjustments`,
      payload: { amount: -5, reason: 'срок для минуса', expiresInDays: 10, idempotencyKey: crypto.randomUUID() },
      headers: bearer(superToken),
    })
    expect(badExpiry.statusCode).toBe(400)
  })

  it('повтор с тем же ключом: одна запись, второй ответ 200; ключ другого счёта — 409', async () => {
    const first = await makeCustomer('idem-a', 0)
    const second = await makeCustomer('idem-b', 0)
    const key = crypto.randomUUID()
    const payload = { amount: 15, reason: 'повтор запроса', idempotencyKey: key }

    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/bonus/accounts/${first.user.id}/adjustments`,
      payload,
      headers: bearer(superToken),
    })
    const replay = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/bonus/accounts/${first.user.id}/adjustments`,
      payload,
      headers: bearer(superToken),
    })

    expect(created.statusCode).toBe(201)
    expect(replay.statusCode).toBe(200)
    expect(JSON.parse(replay.body).transaction.id).toBe(JSON.parse(created.body).transaction.id)
    expect(JSON.parse(replay.body).balance).toBe(15)
    expect(await db.bonusTransaction.count({ where: { idempotencyKey: `manual:${key}` } })).toBe(1)

    const reused = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/bonus/accounts/${second.user.id}/adjustments`,
      payload,
      headers: bearer(superToken),
    })
    expect(reused.statusCode).toBe(409)
    expect(JSON.parse(reused.body).error.code).toBe('IDEMPOTENCY_KEY_REUSED')
  })

  it('счёт не найден → 404; нулевая сумма → 400', async () => {
    const user = await db.user.create({ data: { email: `no-account-${RUN}${MAIL_DOMAIN}`, name: 'Без счёта', role: 'customer' } })

    const missing = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/bonus/accounts/${user.id}/adjustments`,
      payload: { amount: 5, reason: 'нет счёта', idempotencyKey: crypto.randomUUID() },
      headers: bearer(superToken),
    })
    expect(missing.statusCode).toBe(404)
    expect(JSON.parse(missing.body).error.code).toBe('BONUS_ACCOUNT_NOT_FOUND')

    const { user: withAccount } = await makeCustomer('zero-amount', 5)
    const zero = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/bonus/accounts/${withAccount.id}/adjustments`,
      payload: { amount: 0, reason: 'ноль', idempotencyKey: crypto.randomUUID() },
      headers: bearer(superToken),
    })
    expect(zero.statusCode).toBe(400)
  })

  it('поиск участников: короче трёх символов — 400; по части email находит счёт; карточка показывает причину и автора', async () => {
    const { user } = await makeCustomer(`searchable-${RUN}`, 0)
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/bonus/accounts/${user.id}/adjustments`,
      payload: { amount: 7, reason: 'видно только сотрудникам', idempotencyKey: crypto.randomUUID() },
      headers: bearer(superToken),
    })

    const short = await app.inject({ method: 'GET', url: '/api/v1/admin/bonus/accounts?search=ab', headers: bearer(superToken) })
    expect(short.statusCode).toBe(400)

    const found = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/bonus/accounts?search=searchable-${RUN}`,
      headers: bearer(superToken),
    })
    expect(found.statusCode).toBe(200)
    expect(JSON.parse(found.body).items.map((i: { userId: string }) => i.userId)).toContain(user.id)

    const card = await app.inject({ method: 'GET', url: `/api/v1/admin/bonus/accounts/${user.id}`, headers: bearer(superToken) })
    expect(card.statusCode).toBe(200)
    const detail = JSON.parse(card.body)
    expect(detail.account).toMatchObject({ userId: user.id, balance: 7 })
    expect(detail.transactions[0]).toMatchObject({ reason: 'видно только сотрудникам', createdBy: { name: 'Сотрудник super' } })
  })
})
