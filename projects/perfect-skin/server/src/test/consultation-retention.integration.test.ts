import { describe, it, expect, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { db, type Prisma, type PrismaClient } from '../lib/db.js'
import { applyConsultationRetention, AUTO_CLOSE_NOTE } from '../lib/consultation-retention.js'
import { CONSENT_TEXT_VERSION } from '../lib/consents.js'

// Функция работает по всей таблице заявок, поэтому этот набор гоняем только на dev-базе.
const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date()
const TAG = `Retention ${randomUUID().slice(0, 8)}`
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS)

const createdRequests: string[] = []
const createdUsers: string[] = []

async function makeRequest(overrides: Partial<Prisma.ConsultationRequestUncheckedCreateInput> = {}) {
  const row = await db.consultationRequest.create({
    data: {
      name: TAG,
      phone: '79991234567',
      email: 'retention-test@example.test',
      message: 'Тестовое сообщение',
      channel: 'phone',
      source: 'care',
      status: 'new',
      adminNote: 'звонили дважды',
      consentVersion: CONSENT_TEXT_VERSION.care,
      consentedAt: daysAgo(200),
      updatedAt: daysAgo(100),
      ...overrides,
    },
  })
  createdRequests.push(row.id)
  return row
}

async function makeUser(overrides: Partial<Prisma.UserUncheckedCreateInput> = {}) {
  const user = await db.user.create({
    data: {
      email: `retention-${randomUUID().slice(0, 8)}@ps-retention.local`,
      name: `${TAG} user`,
      role: 'customer',
      ...overrides,
    },
  })
  createdUsers.push(user.id)
  return user
}

afterAll(async () => {
  await db.consultationConsent.deleteMany({ where: { consultationId: { in: createdRequests } } })
  await db.consultationRequest.deleteMany({ where: { id: { in: createdRequests } } })
  await db.consentRecord.deleteMany({ where: { userId: { in: createdUsers } } })
  await db.user.deleteMany({ where: { id: { in: createdUsers } } })
})

describe('applyConsultationRetention на реальной базе', () => {
  it('89 дней без движения не трогаем', async () => {
    const row = await makeRequest({ updatedAt: daysAgo(89) })

    await applyConsultationRetention(db, NOW, { apply: true })

    const after = await db.consultationRequest.findUniqueOrThrow({ where: { id: row.id } })
    expect(after).toMatchObject({ status: 'new', name: TAG, anonymizedAt: null })
  })

  it('91 день: открытая заявка закрывается и стирается, заметка «закрыта автоматически» остаётся', async () => {
    const row = await makeRequest({ status: 'new', updatedAt: daysAgo(91) })

    await applyConsultationRetention(db, NOW, { apply: true })

    const after = await db.consultationRequest.findUniqueOrThrow({ where: { id: row.id } })
    expect(after).toMatchObject({
      status: 'cancelled',
      adminNote: AUTO_CLOSE_NOTE,
      name: 'Удалено',
      phone: '',
      email: null,
      message: null,
      anonymizedAt: expect.any(Date),
    })
  })

  it('userId обнуляется: история не ведёт к человеку', async () => {
    const user = await makeUser()
    const row = await makeRequest({ userId: user.id, updatedAt: daysAgo(100) })

    await applyConsultationRetention(db, NOW, { apply: true })

    const after = await db.consultationRequest.findUniqueOrThrow({ where: { id: row.id } })
    expect(after.userId).toBeNull()
  })

  it('закрытая заявка стирается, статус сохраняется, заметка менеджера уходит', async () => {
    const row = await makeRequest({ status: 'done', adminNote: 'перезвонить', updatedAt: daysAgo(100) })

    await applyConsultationRetention(db, NOW, { apply: true })

    const after = await db.consultationRequest.findUniqueOrThrow({ where: { id: row.id } })
    expect(after).toMatchObject({ status: 'done', adminNote: null, name: 'Удалено', anonymizedAt: expect.any(Date) })
  })

  it('согласия заявки не меняются: дата, IP, версия и отзыв остаются как были', async () => {
    const row = await makeRequest({ status: 'new', updatedAt: daysAgo(100) })
    const revokedAt = daysAgo(30)
    const [active, revoked] = await Promise.all([
      db.consultationConsent.create({
        data: { consultationId: row.id, purpose: 'care', textVersion: CONSENT_TEXT_VERSION.care, ip: '203.0.113.7', form: 'care' },
      }),
      db.consultationConsent.create({
        data: {
          consultationId: row.id,
          purpose: 'marketing',
          textVersion: CONSENT_TEXT_VERSION.care_marketing,
          ip: '203.0.113.7',
          form: 'care',
          revokedAt,
        },
      }),
    ])

    await applyConsultationRetention(db, NOW, { apply: true })

    const consents = await db.consultationConsent.findMany({ where: { consultationId: row.id }, orderBy: { id: 'asc' } })
    const byId = Object.fromEntries(consents.map((c) => [c.id, c]))
    expect(byId[active.id]).toMatchObject({ ip: '203.0.113.7', revokedAt: null, textVersion: CONSENT_TEXT_VERSION.care })
    expect(byId[revoked.id]).toMatchObject({ ip: '203.0.113.7', revokedAt, textVersion: CONSENT_TEXT_VERSION.care_marketing })
  })

  it('повторный прогон ничего не меняет', async () => {
    const row = await makeRequest({ status: 'contacted', updatedAt: daysAgo(120) })

    await applyConsultationRetention(db, NOW, { apply: true })
    const first = await db.consultationRequest.findUniqueOrThrow({ where: { id: row.id } })
    const second = await applyConsultationRetention(db, NOW, { apply: true })
    const afterSecond = await db.consultationRequest.findUniqueOrThrow({ where: { id: row.id } })

    expect(afterSecond.anonymizedAt).toEqual(first.anonymizedAt)
    expect(afterSecond.updatedAt).toEqual(first.updatedAt)
    expect(afterSecond.status).toBe('cancelled')
    expect(second.erased).toBe(0)
  })

  it('кабинет и согласия специалиста не трогаются, стирается только заявка', async () => {
    const pro = await makeUser({ role: 'professional', proStatus: 'approved', companyName: 'Салон Тест' })
    const proConsent = await db.consentRecord.create({
      data: { userId: pro.id, purpose: 'marketing', textVersion: CONSENT_TEXT_VERSION.marketing },
    })
    const proAccount = await db.consentRecord.create({
      data: { userId: pro.id, purpose: 'pro_application', textVersion: CONSENT_TEXT_VERSION.pro_application },
    })
    const row = await makeRequest({ userId: pro.id, updatedAt: daysAgo(100) })

    await applyConsultationRetention(db, NOW, { apply: true })

    const erased = await db.consultationRequest.findUniqueOrThrow({ where: { id: row.id } })
    expect(erased).toMatchObject({ userId: null, name: 'Удалено' })

    const userAfter = await db.user.findUniqueOrThrow({ where: { id: pro.id } })
    expect(userAfter).toMatchObject({ name: pro.name, proStatus: 'approved', companyName: 'Салон Тест', deletedAt: null })
    const consentAfter = await db.consentRecord.findUniqueOrThrow({ where: { id: proConsent.id } })
    expect(consentAfter.revokedAt).toBeNull()
    const accountAfter = await db.consentRecord.findUniqueOrThrow({ where: { id: proAccount.id } })
    expect(accountAfter.revokedAt).toBeNull()
  })

  it('правка менеджера после снимка не перезаписывается: в базе заявка свежая, план по старому снимку её не трогает', async () => {
    const row = await makeRequest({ status: 'new', updatedAt: new Date() })
    // Снимок показывает заявку старой, как до правки менеджера; запись идёт в реальную базу
    const staleSnapshot = {
      consultationRequest: {
        findMany: async () => [{ id: row.id, status: 'new', updatedAt: daysAgo(100), anonymizedAt: null }],
      },
      $transaction: (fn: Parameters<typeof db.$transaction>[0]) => db.$transaction(fn),
    } as unknown as PrismaClient

    await applyConsultationRetention(staleSnapshot, NOW, { apply: true })

    const after = await db.consultationRequest.findUniqueOrThrow({ where: { id: row.id } })
    expect(after).toMatchObject({ status: 'new', name: TAG, anonymizedAt: null })
  })

  it('прогон без apply только считает и ничего не пишет', async () => {
    const row = await makeRequest({ status: 'new', updatedAt: daysAgo(100) })

    const counts = await applyConsultationRetention(db, NOW, { apply: false })

    const after = await db.consultationRequest.findUniqueOrThrow({ where: { id: row.id } })
    expect(after).toMatchObject({ status: 'new', name: TAG, anonymizedAt: null })
    expect(counts.closed).toBeGreaterThanOrEqual(1)
    expect(counts.erased).toBeGreaterThanOrEqual(1)
  })
})
