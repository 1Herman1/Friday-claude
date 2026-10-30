import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import prismaPlugin from '../plugins/prisma.js'
import authenticatePlugin from '../plugins/authenticate.js'
import { ApiError, errorResponse } from '../lib/errors.js'
import { registerCommonSchemas } from '../schemas/common.js'
import bonusRoutes from '../routes/bonus/index.js'
import { db, $Enums } from '../lib/db.js'
import { CONSENT_TEXT_VERSION } from '../lib/consents.js'
import { bonusService } from '../services/bonus.service.js'

const { sign } = jwt
const MAIL_DOMAIN = '@ps-bonus-test.local'
const RUN = crypto.randomUUID().slice(0, 8)
const DAY_MS = 86_400_000

let app: FastifyInstance

async function build(): Promise<FastifyInstance> {
  const server = Fastify()
  registerCommonSchemas(server)
  await server.register(prismaPlugin)
  await server.register(cookie, { secret: process.env.PS_COOKIE_SECRET || 'test-secret', hook: 'preHandler' })
  await server.register(rateLimit, { max: 10000, timeWindow: '1 minute' })
  await server.register(authenticatePlugin)
  server.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send(errorResponse(error))
    if ((error as { validation?: unknown }).validation) {
      return reply.status(400).send(errorResponse(new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')))
    }
    reply.status(500).send(errorResponse(new ApiError(500, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера')))
  })
  await server.register(bonusRoutes)
  return server
}

async function setProgram(enabled: boolean): Promise<void> {
  await db.loyaltySettings.update({ where: { id: 1 }, data: { enabled, welcomeBonus: 0 } })
}

async function cleanup(): Promise<void> {
  const users = await db.user.findMany({ where: { email: { endsWith: MAIL_DOMAIN } }, select: { id: true } })
  const userIds = users.map((u) => u.id)
  if (userIds.length === 0) return
  const accounts = await db.bonusAccount.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
  await db.bonusTransaction.deleteMany({ where: { accountId: { in: accounts.map((a) => a.id) } } })
  await db.bonusAccount.deleteMany({ where: { id: { in: accounts.map((a) => a.id) } } })
  await db.consentRecord.deleteMany({ where: { userId: { in: userIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
}

async function makeUser(label: string, role: $Enums.UserRole = 'customer') {
  return db.user.create({
    data: { email: `${label}-${RUN}${MAIL_DOMAIN}`, name: `Тест ${label}`, role },
  })
}

function authHeader(user: { id: string; role: string; tokenVersion: number }): { authorization: string } {
  const token = sign({ userId: user.id, role: user.role, tv: user.tokenVersion }, process.env.JWT_SECRET || 'dev-secret')
  return { authorization: `Bearer ${token}` }
}

async function seedBalance(userId: string, amount: number, expiresAt: Date | null): Promise<void> {
  const account = await db.bonusAccount.findUniqueOrThrow({ where: { userId } })
  await db.bonusAccount.update({ where: { id: account.id }, data: { balance: { increment: amount } } })
  await db.bonusTransaction.create({
    data: { accountId: account.id, type: 'welcome', amount, remaining: amount, expiresAt },
  })
}

describe('Бонусы покупателя: сводка, история, вступление и выход (HTTP)', () => {
  beforeAll(async () => {
    app = await build()
    await cleanup()
    await setProgram(true)
  })

  afterAll(async () => {
    await cleanup()
    await setProgram(false)
    await app.close()
  })

  it('без входа все эндпоинты отвечают 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/bonus' })).statusCode).toBe(401)
    expect((await app.inject({ method: 'GET', url: '/api/v1/bonus/transactions' })).statusCode).toBe(401)
    expect((await app.inject({ method: 'POST', url: '/api/v1/bonus/membership', payload: { acceptRules: true } })).statusCode).toBe(401)
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/bonus/membership' })).statusCode).toBe(401)
  })

  it('сводка до вступления: программа включена, участия нет, баланс 0, версия правил из согласия', async () => {
    const user = await makeUser('summary')

    const res = await app.inject({ method: 'GET', url: '/api/v1/bonus', headers: authHeader(user) })

    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(JSON.parse(res.body)).toMatchObject({
      programEnabled: true,
      eligible: true,
      member: false,
      joinedAt: null,
      balance: 0,
      balanceValue: 0,
      nextExpiration: null,
      rulesVersion: CONSENT_TEXT_VERSION.loyalty,
    })
  })

  it('вступление требует acceptRules: true; повторное вступление не дублирует согласие', async () => {
    const user = await makeUser('join')
    const headers = authHeader(user)

    const rejected = await app.inject({ method: 'POST', url: '/api/v1/bonus/membership', payload: {}, headers })
    expect(rejected.statusCode).toBe(400)
    expect(JSON.parse(rejected.body).error.code).toBe('VALIDATION_ERROR')
    expect(await db.bonusAccount.count({ where: { userId: user.id } })).toBe(0)

    const first = await app.inject({ method: 'POST', url: '/api/v1/bonus/membership', payload: { acceptRules: true }, headers })
    expect(first.statusCode).toBe(200)
    expect(JSON.parse(first.body)).toMatchObject({ member: true, eligible: true })

    const second = await app.inject({ method: 'POST', url: '/api/v1/bonus/membership', payload: { acceptRules: true }, headers })
    expect(second.statusCode).toBe(200)

    const consents = await db.consentRecord.findMany({ where: { userId: user.id, purpose: 'loyalty', revokedAt: null } })
    expect(consents).toHaveLength(1)
    expect(consents[0].textVersion).toBe(CONSENT_TEXT_VERSION.loyalty)
  })

  it('история: без reason и createdBy, постранично, и ближайшее сгорание в сводке', async () => {
    const user = await makeUser('history')
    const headers = authHeader(user)
    await bonusService.join(user.id, { role: 'customer', proStatus: 'none' }, new Date())
    const admin = await makeUser('history-admin', 'super_admin')
    const account = await db.bonusAccount.findUniqueOrThrow({ where: { userId: user.id } })
    const soon = new Date(Date.now() + 10 * DAY_MS)
    await seedBalance(user.id, 120, soon)
    await seedBalance(user.id, 50, new Date(Date.now() + 90 * DAY_MS))
    await db.bonusTransaction.create({
      data: {
        accountId: account.id,
        type: 'manual_adjustment',
        amount: 30,
        remaining: 30,
        expiresAt: null,
        reason: 'внутренняя заметка сотрудника',
        createdById: admin.id,
      },
    })

    const summary = await app.inject({ method: 'GET', url: '/api/v1/bonus', headers })
    expect(JSON.parse(summary.body)).toMatchObject({
      balance: 200,
      balanceValue: 20_000,
      nextExpiration: { amount: 120, expiresAt: soon.toISOString() },
    })

    const page = await app.inject({ method: 'GET', url: '/api/v1/bonus/transactions?limit=2&offset=0', headers })
    expect(page.statusCode).toBe(200)
    const body = JSON.parse(page.body)
    expect(body.total).toBe(3)
    expect(body.items).toHaveLength(2)
    for (const item of body.items) {
      expect(item).not.toHaveProperty('reason')
      expect(item).not.toHaveProperty('createdBy')
      expect(item).not.toHaveProperty('createdById')
    }
    expect(page.body).not.toContain('внутренняя заметка')

    const rest = await app.inject({ method: 'GET', url: '/api/v1/bonus/transactions?limit=2&offset=2', headers })
    expect(JSON.parse(rest.body).items).toHaveLength(1)

    const bad = await app.inject({ method: 'GET', url: '/api/v1/bonus/transactions?limit=0', headers })
    expect(bad.statusCode).toBe(400)
  })

  it('выход из клуба замораживает остаток, согласие отзывается, повторный выход безопасен', async () => {
    const user = await makeUser('leave')
    const headers = authHeader(user)
    await bonusService.join(user.id, { role: 'customer', proStatus: 'none' }, new Date())
    await seedBalance(user.id, 40, null)

    const res = await app.inject({ method: 'DELETE', url: '/api/v1/bonus/membership', headers })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ member: false, joinedAt: null, balance: 40 })
    const consent = await db.consentRecord.findFirstOrThrow({ where: { userId: user.id, purpose: 'loyalty' } })
    expect(consent.revokedAt).not.toBeNull()

    const again = await app.inject({ method: 'DELETE', url: '/api/v1/bonus/membership', headers })
    expect(again.statusCode).toBe(200)
    expect(JSON.parse(again.body)).toMatchObject({ member: false, balance: 40 })
  })

  it('выключенная программа: сводка говорит об этом, вступление отказано', async () => {
    const user = await makeUser('disabled')
    const headers = authHeader(user)
    await setProgram(false)
    try {
      const summary = await app.inject({ method: 'GET', url: '/api/v1/bonus', headers })
      expect(JSON.parse(summary.body)).toMatchObject({ programEnabled: false, member: false })

      const join = await app.inject({ method: 'POST', url: '/api/v1/bonus/membership', payload: { acceptRules: true }, headers })
      expect(join.statusCode).toBe(409)
      expect(JSON.parse(join.body).error.code).toBe('BONUS_PROGRAM_DISABLED')
    } finally {
      await setProgram(true)
    }
  })
})
