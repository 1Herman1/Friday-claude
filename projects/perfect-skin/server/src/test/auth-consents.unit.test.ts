import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { ApiError, errorResponse } from '../lib/errors.js'
import { registerCommonSchemas } from '../schemas/common.js'
import authenticatePlugin from '../plugins/authenticate.js'
import { verifyOtpRoute } from '../routes/auth/verify-otp.js'
import { marketingConsentRoute } from '../routes/auth/marketing.js'
import { consultationsRoutes } from '../routes/admin/consultations.js'
import careRequestsRoute from '../routes/care-requests.js'
import consultationsRoute from '../routes/consultations.js'
import { CONSENT_TEXT_VERSION } from '../lib/consents.js'
import { otpService } from '../services/otp.service.js'

// Внешние границы входа: проверка кода и слияние корзины ходят в базу через свой клиент
vi.mock('../services/otp.service.js', () => ({
  otpService: { verifyCode: vi.fn(), findOrCreateUser: vi.fn() },
}))
vi.mock('../services/cart.service.js', () => ({
  cartService: { mergeGuestCart: vi.fn(async () => false) },
}))

type Row = Record<string, unknown>

// Хранилище в памяти и разбор тех форм where, что встречаются в маршрутах.
// Незнакомая форма фильтра — падение, а не молчаливое «совпало».
function createStore() {
  const tables = {
    user: [] as Row[],
    consentRecord: [] as Row[],
    consultationRequest: [] as Row[],
    consultationConsent: [] as Row[],
  }

  function matches(row: Row, where: Row): boolean {
    for (const [key, cond] of Object.entries(where)) {
      if (cond === undefined) continue
      if (key === 'OR') {
        if (!(cond as Row[]).some((w) => matches(row, w))) return false
        continue
      }
      if (key === 'consultation') {
        const parent = tables.consultationRequest.find((c) => c.id === row.consultationId)
        if (!parent || !matches(parent, cond as Row)) return false
        continue
      }
      const value = row[key] ?? null
      if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
        const op = cond as Row
        if (Array.isArray(op.in)) {
          if (!op.in.includes(value)) return false
          continue
        }
        throw new Error(`unsupported filter on ${key}: ${JSON.stringify(cond)}`)
      }
      if (value !== cond) return false
    }
    return true
  }

  function model(name: keyof typeof tables, defaults: () => Row) {
    const rows = tables[name]
    return {
      findUnique: async ({ where }: { where: Row }) => rows.find((r) => matches(r, where)) ?? null,
      findFirst: async ({ where }: { where: Row }) => rows.find((r) => matches(r, where)) ?? null,
      findMany: async ({ where }: { where: Row }) => rows.filter((r) => matches(r, where)),
      create: async ({ data }: { data: Row }) => {
        const row = { id: randomUUID(), ...defaults(), ...data }
        rows.push(row)
        return row
      },
      createMany: async ({ data }: { data: Row[] }) => {
        for (const d of data) rows.push({ id: randomUUID(), ...defaults(), ...d })
        return { count: data.length }
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const hit = rows.filter((r) => matches(r, where))
        for (const r of hit) Object.assign(r, data)
        return { count: hit.length }
      },
    }
  }

  const prisma = {
    user: model('user', () => ({})),
    consentRecord: model('consentRecord', () => ({ grantedAt: new Date(), revokedAt: null })),
    consultationRequest: model('consultationRequest', () => ({ userId: null, anonymizedAt: null })),
    consultationConsent: model('consultationConsent', () => ({ grantedAt: new Date(), revokedAt: null })),
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  }

  return { tables, prisma }
}

let store: ReturnType<typeof createStore>
let app: FastifyInstance

async function build() {
  const instance = Fastify()
  registerCommonSchemas(instance)
  await instance.register(cookie, { secret: 'test-cookie-secret', hook: 'preHandler' })
  await instance.register(rateLimit, { max: 10000, timeWindow: '1 minute' })
  instance.decorate('prisma', store.prisma as never)
  instance.decorate('telegram', { onNewConsultation: async () => {} } as never)
  await instance.register(authenticatePlugin)
  instance.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send(errorResponse(error))
    console.error('ТЕСТ-500:', error)
    return reply.status(500).send(errorResponse(new ApiError(500, 'INTERNAL_ERROR', 'Внутренняя ошибка')))
  })
  await verifyOtpRoute(instance)
  await marketingConsentRoute(instance)
  await instance.register(careRequestsRoute)
  await instance.register(consultationsRoute)
  await instance.register(async (admin) => consultationsRoutes(admin, [admin.authenticate]), { prefix: '/api/v1/admin' })
  await instance.ready()
  return instance
}

function makeUser(overrides: Row = {}): Row {
  const user = {
    id: randomUUID(),
    email: `u-${Math.random().toString(36).slice(2)}@example.test`,
    phone: null,
    name: 'Покупатель',
    role: 'customer',
    isActive: true,
    deletedAt: null,
    tokenVersion: 0,
    proStatus: 'none',
    ...overrides,
  }
  store.tables.user.push(user)
  return user
}

function authCookie(user: Row): string {
  const token = jwt.sign(
    { userId: user.id, role: user.role, tv: user.tokenVersion },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '1h' },
  )
  return `ps_auth=${token}`
}

function addRequest(overrides: Row): Row {
  const req = {
    id: randomUUID(),
    userId: null,
    name: 'Гость',
    phone: '79990000000',
    source: 'care',
    status: 'new',
    adminNote: null,
    anonymizedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
  store.tables.consultationRequest.push(req)
  return req
}

function addConsultationConsent(consultationId: string, purpose: string): Row {
  const consent = {
    id: randomUUID(),
    consultationId,
    purpose,
    textVersion: CONSENT_TEXT_VERSION.care_marketing,
    form: 'care',
    grantedAt: new Date(),
    revokedAt: null,
  }
  store.tables.consultationConsent.push(consent)
  return consent
}

function addConsentRecord(userId: string, purpose: string, textVersion: string): Row {
  const record = { id: randomUUID(), userId, purpose, textVersion, grantedAt: new Date(), revokedAt: null }
  store.tables.consentRecord.push(record)
  return record
}

const records = (userId: string, purpose: string) =>
  store.tables.consentRecord.filter((r) => r.userId === userId && r.purpose === purpose)

beforeEach(async () => {
  store = createStore()
  app = await build()
})

afterEach(async () => {
  await app.close()
  vi.mocked(otpService.verifyCode).mockReset()
  vi.mocked(otpService.findOrCreateUser).mockReset()
})

describe('POST /api/v1/auth/verify-otp: согласия при входе', () => {
  async function signIn(user: Row, extra: Row = {}) {
    vi.mocked(otpService.verifyCode).mockResolvedValue(undefined as never)
    vi.mocked(otpService.findOrCreateUser).mockResolvedValue(user as never)
    return app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      payload: { email: user.email, code: '123456', ...extra },
    })
  }

  it('старый клиент без полей согласий входит, и никаких записей о согласии не появляется', async () => {
    const user = makeUser()
    const res = await signIn(user)

    expect(res.statusCode).toBe(200)
    expect(res.json().user.id).toBe(user.id)
    expect(store.tables.consentRecord).toEqual([])
  })

  it('галочка ПДн без рекламы записывает согласие account текущей версии и не пишет рекламу', async () => {
    const user = makeUser()
    const res = await signIn(user, { consentPd: 'true', consentMarketing: 'false' })

    expect(res.statusCode).toBe(200)
    const account = records(user.id as string, 'account')
    expect(account).toHaveLength(1)
    expect(account[0]).toMatchObject({ textVersion: CONSENT_TEXT_VERSION.account, revokedAt: null })
    expect(records(user.id as string, 'marketing')).toEqual([])
  })

  it('отмеченная реклама записывается с версией текста розничной рекламы', async () => {
    const user = makeUser()
    await signIn(user, { consentPd: 'true', consentMarketing: 'true' })

    const marketing = records(user.id as string, 'marketing')
    expect(marketing).toHaveLength(1)
    expect(marketing[0]).toMatchObject({ textVersion: CONSENT_TEXT_VERSION.retail_marketing, revokedAt: null })
  })

  it('повторный вход с теми же галочками не плодит записи', async () => {
    const user = makeUser()
    await signIn(user, { consentPd: 'true', consentMarketing: 'true' })
    await signIn(user, { consentPd: 'true', consentMarketing: 'true' })

    expect(records(user.id as string, 'account')).toHaveLength(1)
    expect(records(user.id as string, 'marketing')).toHaveLength(1)
  })

  it('повторный вход только с галочкой ПДн оставляет одну запись account', async () => {
    const user = makeUser()
    await signIn(user, { consentPd: 'true', consentMarketing: 'false' })
    await signIn(user, { consentPd: 'true', consentMarketing: 'false' })

    expect(records(user.id as string, 'account')).toHaveLength(1)
  })

  it('согласие account прежней версии текста не засчитывается: при входе пишется новая запись', async () => {
    const user = makeUser()
    addConsentRecord(user.id as string, 'account', '2000-01-01-old')

    await signIn(user, { consentPd: 'true', consentMarketing: 'false' })

    const versions = records(user.id as string, 'account').map((r) => r.textVersion)
    expect(versions).toEqual(['2000-01-01-old', CONSENT_TEXT_VERSION.account])
  })

  it('вход с рекламной галочкой при активной рассылке специалистам создаёт розничное согласие', async () => {
    const user = makeUser()
    addConsentRecord(user.id as string, 'marketing', CONSENT_TEXT_VERSION.marketing)

    await signIn(user, { consentPd: 'true', consentMarketing: 'true' })

    const retail = records(user.id as string, 'marketing').filter((r) => r.textVersion === CONSENT_TEXT_VERSION.retail_marketing)
    expect(retail).toHaveLength(1)
  })

  it('вход без рекламной галочки не отзывает ранее данное согласие на рекламу', async () => {
    const user = makeUser()
    const earlier = addConsentRecord(user.id as string, 'marketing', CONSENT_TEXT_VERSION.retail_marketing)

    const res = await signIn(user, { consentPd: 'true', consentMarketing: 'false' })

    expect(res.statusCode).toBe(200)
    expect(earlier.revokedAt).toBeNull()
  })

  it('неверный код: вход отклонён и согласия не записаны', async () => {
    const user = makeUser()
    vi.mocked(otpService.verifyCode).mockRejectedValue(new ApiError(400, 'INVALID_CODE', 'Неверный код'))
    vi.mocked(otpService.findOrCreateUser).mockResolvedValue(user as never)

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      payload: { email: user.email, code: '000000', consentPd: 'true', consentMarketing: 'true' },
    })

    expect(res.statusCode).toBe(400)
    expect(store.tables.consentRecord).toEqual([])
  })
})

describe('GET/PATCH /api/v1/auth/me/marketing', () => {
  it('без входа GET отдаёт 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me/marketing' })
    expect(res.statusCode).toBe(401)
  })

  it('без входа PATCH отдаёт 401 и ничего не пишет', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/v1/auth/me/marketing', payload: { consent: true } })
    expect(res.statusCode).toBe(401)
    expect(store.tables.consentRecord).toEqual([])
  })

  it('токен с устаревшей версией сессии не проходит', async () => {
    const user = makeUser()
    const cookieValue = authCookie(user)
    user.tokenVersion = 1

    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me/marketing', headers: { cookie: cookieValue } })
    expect(res.statusCode).toBe(401)
  })

  it('без согласий GET отдаёт consent: false', async () => {
    const user = makeUser()
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me/marketing', headers: { cookie: authCookie(user) } })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ consent: false })
  })

  it('включение идемпотентно: два PATCH true — одна активная запись, GET — true', async () => {
    const user = makeUser()
    const headers = { cookie: authCookie(user) }

    const first = await app.inject({ method: 'PATCH', url: '/api/v1/auth/me/marketing', headers, payload: { consent: true } })
    const second = await app.inject({ method: 'PATCH', url: '/api/v1/auth/me/marketing', headers, payload: { consent: true } })
    const get = await app.inject({ method: 'GET', url: '/api/v1/auth/me/marketing', headers })

    expect(first.json()).toEqual({ consent: true })
    expect(second.json()).toEqual({ consent: true })
    expect(records(user.id as string, 'marketing')).toHaveLength(1)
    expect(records(user.id as string, 'marketing')[0]).toMatchObject({ textVersion: CONSENT_TEXT_VERSION.retail_marketing })
    expect(get.json()).toEqual({ consent: true })
  })

  it('после отзыва повторное включение создаёт новую запись, а отозванная остаётся с датой отзыва', async () => {
    const user = makeUser()
    const headers = { cookie: authCookie(user) }

    await app.inject({ method: 'PATCH', url: '/api/v1/auth/me/marketing', headers, payload: { consent: true } })
    await app.inject({ method: 'PATCH', url: '/api/v1/auth/me/marketing', headers, payload: { consent: false } })
    await app.inject({ method: 'PATCH', url: '/api/v1/auth/me/marketing', headers, payload: { consent: true } })

    const marketing = records(user.id as string, 'marketing')
    expect(marketing).toHaveLength(2)
    expect(marketing[0].revokedAt).toBeInstanceOf(Date)
    expect(marketing[1].revokedAt).toBeNull()
  })

  it('отзыв снимает все рекламные согласия человека — в аккаунте и в его заявках; согласие на обработку ПДн не трогает', async () => {
    const user = makeUser()
    const retail = addConsentRecord(user.id as string, 'marketing', CONSENT_TEXT_VERSION.retail_marketing)
    const specialist = addConsentRecord(user.id as string, 'marketing', CONSENT_TEXT_VERSION.marketing)
    const account = addConsentRecord(user.id as string, 'account', CONSENT_TEXT_VERSION.account)
    const ownRequest = addRequest({ userId: user.id, phone: '79991112233' })
    const ownMarketing = addConsultationConsent(ownRequest.id as string, 'marketing')
    const ownCare = addConsultationConsent(ownRequest.id as string, 'care')

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/me/marketing',
      headers: { cookie: authCookie(user) },
      payload: { consent: false },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ consent: false })
    expect(retail.revokedAt).toBeInstanceOf(Date)
    expect(specialist.revokedAt).toBeInstanceOf(Date)
    expect(ownMarketing.revokedAt).toBeInstanceOf(Date)
    expect(account.revokedAt).toBeNull()
    expect(ownCare.revokedAt).toBeNull()
  })

  it('отзыв у пользователя с телефоном снимает рекламу и в гостевых заявках с тем же номером', async () => {
    const user = makeUser({ phone: '79994445566' })
    const guestRequest = addRequest({ userId: null, phone: '79994445566' })
    const guestMarketing = addConsultationConsent(guestRequest.id as string, 'marketing')

    await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/me/marketing',
      headers: { cookie: authCookie(user) },
      payload: { consent: false },
    })

    expect(guestMarketing.revokedAt).toBeInstanceOf(Date)
  })

  it('отзыв пользователя без телефона не задевает стёртые заявки (phone пустой) и чужие согласия', async () => {
    const user = makeUser({ phone: null })
    const other = makeUser()
    const otherRecord = addConsentRecord(other.id as string, 'marketing', CONSENT_TEXT_VERSION.retail_marketing)
    const anonymized = addRequest({ userId: null, phone: '', name: 'Удалено', anonymizedAt: new Date() })
    const anonymizedMarketing = addConsultationConsent(anonymized.id as string, 'marketing')
    const strangerRequest = addRequest({ userId: other.id, phone: '79990001122' })
    const strangerMarketing = addConsultationConsent(strangerRequest.id as string, 'marketing')

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/me/marketing',
      headers: { cookie: authCookie(user) },
      payload: { consent: false },
    })

    expect(res.statusCode).toBe(200)
    expect(anonymizedMarketing.revokedAt).toBeNull()
    expect(strangerMarketing.revokedAt).toBeNull()
    expect(otherRecord.revokedAt).toBeNull()
  })

  it('рассылка специалистам не считается рекламой покупателя: GET false, а включение создаёт розничное согласие', async () => {
    const user = makeUser()
    addConsentRecord(user.id as string, 'marketing', CONSENT_TEXT_VERSION.marketing)
    const headers = { cookie: authCookie(user) }

    const before = await app.inject({ method: 'GET', url: '/api/v1/auth/me/marketing', headers })
    await app.inject({ method: 'PATCH', url: '/api/v1/auth/me/marketing', headers, payload: { consent: true } })

    expect(before.json()).toEqual({ consent: false })
    const retail = records(user.id as string, 'marketing').filter((r) => r.textVersion === CONSENT_TEXT_VERSION.retail_marketing)
    expect(retail).toHaveLength(1)
  })

  it('прежняя версия рекламного текста покупателя (с «звонком») остаётся действующим согласием', async () => {
    const user = makeUser()
    addConsentRecord(user.id as string, 'marketing', '2026-10-16-draft')

    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me/marketing', headers: { cookie: authCookie(user) } })

    expect(res.json()).toEqual({ consent: true })
  })

  it.each([{ consent: 'false' }, { consent: null }, {}])('невалидное тело %j — 400 и ничего не меняется', async (payload) => {
    const user = makeUser()
    const record = addConsentRecord(user.id as string, 'marketing', CONSENT_TEXT_VERSION.retail_marketing)

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/me/marketing',
      headers: { cookie: authCookie(user) },
      payload,
    })

    expect(res.statusCode).toBe(400)
    expect(record.revokedAt).toBeNull()
  })
})

describe('PATCH /api/v1/admin/consultations/:id/marketing-revoke после стирания', () => {
  it('отметка отзыва на чужой стёртой заявке не снимает согласия в других стёртых заявках', async () => {
    const manager = makeUser({ role: 'super_admin' })
    const target = addRequest({ userId: null, phone: '', name: 'Удалено', anonymizedAt: new Date() })
    addConsultationConsent(target.id as string, 'marketing')
    const otherAnonymized = addRequest({ userId: null, phone: '', name: 'Удалено', anonymizedAt: new Date() })
    const otherMarketing = addConsultationConsent(otherAnonymized.id as string, 'marketing')

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/consultations/${target.id}/marketing-revoke`,
      headers: { cookie: authCookie(manager) },
    })

    expect(res.statusCode).toBe(200)
    expect(otherMarketing.revokedAt).toBeNull()
  })

  // Стёртая гостевая заявка не сопоставляется ни по userId, ни по телефону: снять может только сама заявка
  it('отметка отзыва на стёртой гостевой заявке снимает согласие самой этой заявки', async () => {
    const manager = makeUser({ role: 'super_admin' })
    const target = addRequest({ userId: null, phone: '', name: 'Удалено', anonymizedAt: new Date() })
    const ownMarketing = addConsultationConsent(target.id as string, 'marketing')

    await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/consultations/${target.id}/marketing-revoke`,
      headers: { cookie: authCookie(manager) },
    })

    expect(ownMarketing.revokedAt).toBeInstanceOf(Date)
  })
})

describe('POST /api/v1/consultations от вошедшего покупателя', () => {
  it('заявка привязывается к аккаунту и пишет его согласия на обработку ПДн и на состояние кожи', async () => {
    const user = makeUser({ phone: null })

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/consultations',
      headers: { cookie: authCookie(user) },
      payload: { name: 'Анна', phone: '+7 999 123-45-67', channel: 'phone', consentPd: 'true', consentHealth: 'true' },
    })

    expect(res.statusCode).toBe(200)
    expect(store.tables.consultationRequest[0].userId).toBe(user.id)
    expect(records(user.id as string, 'consultation')).toHaveLength(1)
    expect(records(user.id as string, 'health_data')).toHaveLength(1)
  })
})

describe('PATCH /api/v1/admin/consultations/:id у стёртой заявки', () => {
  it('смена статуса и заметки отвечает 409 и ничего не пишет', async () => {
    const manager = makeUser({ role: 'super_admin' })
    const target = addRequest({ userId: null, phone: '', name: 'Удалено', status: 'cancelled', anonymizedAt: new Date() })

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/consultations/${target.id}`,
      headers: { cookie: authCookie(manager) },
      payload: { status: 'done', adminNote: 'новая заметка' },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().error.message).toBe('Данные заявки удалены по сроку')
    expect(target).toMatchObject({ status: 'cancelled', adminNote: null })
  })
})

describe('Отзыв в профиле и заявка Отдела заботы, поданная из аккаунта', () => {
  // Вошедший покупатель: заявка привязана к аккаунту, поэтому отзыв в профиле до неё дотягивается
  it('заявка Отдела заботы от вошедшего покупателя привязывается к аккаунту, и отзыв в профиле снимает её рекламное согласие', async () => {
    const user = makeUser({ phone: null })
    const headers = { cookie: authCookie(user) }

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/care-requests',
      headers,
      payload: { name: 'Анна', phone: '+7 999 123-45-67', channel: 'phone', consentPd: 'true', consentMarketing: 'true' },
    })
    expect(created.statusCode).toBe(200)

    await app.inject({ method: 'PATCH', url: '/api/v1/auth/me/marketing', headers, payload: { consent: false } })

    const careMarketing = store.tables.consultationConsent.filter((c) => c.purpose === 'marketing')
    expect(careMarketing).toHaveLength(1)
    expect(store.tables.consultationRequest[0].userId).toBe(user.id)
    expect(careMarketing[0].revokedAt).toBeInstanceOf(Date)
  })
})
