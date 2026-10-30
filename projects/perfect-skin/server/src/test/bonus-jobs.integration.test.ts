import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import crypto from 'crypto'
import { db } from '../lib/db.js'
import { bonusService } from '../services/bonus.service.js'
import {
  reconcileBonusBalances,
  runBonusAccruals,
  runBonusAnonymize,
  runBonusExpirations,
} from '../lib/bonus-jobs.js'

const MAIL_DOMAIN = '@ps-bonus-test.local'
const VIEWER = { role: 'customer', proStatus: 'none' }
const DAY_MS = 86_400_000
const NOW = new Date()
const runTag = crypto.randomUUID().slice(0, 8)

// Счета без userId (обезличенные и удалённые жёстко) не находятся по почте: чистим их явно
const strayAccountIds: string[] = []
const strayConsentIds: string[] = []

async function cleanup(): Promise<void> {
  const users = await db.user.findMany({ where: { email: { endsWith: MAIL_DOMAIN } }, select: { id: true } })
  const userIds = users.map((u) => u.id)
  if (userIds.length === 0) return
  const accounts = await db.bonusAccount.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
  const accountIds = accounts.map((a) => a.id)

  await db.bonusTransaction.deleteMany({ where: { accountId: { in: accountIds } } })
  await db.bonusAccount.deleteMany({ where: { id: { in: accountIds } } })
  await db.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } })
  await db.order.deleteMany({ where: { userId: { in: userIds } } })
  await db.cart.deleteMany({ where: { userId: { in: userIds } } })
  await db.consentRecord.deleteMany({ where: { userId: { in: userIds } } })
  await db.otpCode.deleteMany({ where: { userId: { in: userIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
}

async function setProgram(enabled: boolean): Promise<void> {
  await db.loyaltySettings.update({ where: { id: 1 }, data: { enabled, welcomeBonus: 0, accrualDelayDays: 0 } })
}

async function makeUser(label: string) {
  return db.user.create({
    data: { email: `${label}-${runTag}${MAIL_DOMAIN}`, name: `Тест ${label}`, role: 'customer' },
  })
}

async function makeAccount(label: string) {
  const user = await makeUser(label)
  await bonusService.join(user.id, VIEWER, NOW)
  return db.bonusAccount.findUniqueOrThrow({ where: { userId: user.id } })
}

async function balanceOf(accountId: string): Promise<number> {
  return (await db.bonusAccount.findUniqueOrThrow({ where: { id: accountId } })).balance
}

async function seedLot(accountId: string, amount: number, expiresAt: Date | null): Promise<string> {
  await db.bonusAccount.update({ where: { id: accountId }, data: { balance: { increment: amount } } })
  const lot = await db.bonusTransaction.create({
    data: { accountId, type: 'welcome', amount, remaining: amount, expiresAt },
    select: { id: true },
  })
  return lot.id
}

async function makeDueOrder(userId: string, planned: number): Promise<string> {
  const order = await db.order.create({
    data: {
      number: `PS-BT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      userId,
      deliveryMethod: 'pickup',
      recipientName: 'Тест',
      recipientPhone: '+70000000000',
      subtotal: 0,
      total: 0,
      status: 'delivered',
      paymentStatus: 'paid',
      bonusAccrualPlanned: planned,
      bonusAccrualDueAt: new Date(NOW.getTime() - DAY_MS),
    },
  })
  return order.id
}

const daysFromNow = (days: number): Date => new Date(NOW.getTime() + days * DAY_MS)

describe('Ночные задачи бонусов на реальной базе', () => {
  beforeAll(async () => {
    await cleanup()
    await setProgram(true)
  })

  afterAll(async () => {
    await db.bonusTransaction.deleteMany({ where: { accountId: { in: strayAccountIds } } })
    await db.bonusAccount.deleteMany({ where: { id: { in: strayAccountIds } } })
    await db.consentRecord.deleteMany({ where: { id: { in: strayConsentIds } } })
    await cleanup()
    await setProgram(false)
  })

  it('сгорание: просроченная партия сгорает один раз, живая не трогается, повторный прогон ничего не меняет', async () => {
    const account = await makeAccount('expire')
    const expiredLot = await seedLot(account.id, 70, daysFromNow(-1))
    await seedLot(account.id, 30, daysFromNow(30))

    await runBonusExpirations(db, NOW, { apply: true })
    expect(await balanceOf(account.id)).toBe(30)
    expect(await db.bonusTransaction.findUniqueOrThrow({ where: { id: expiredLot } })).toMatchObject({ remaining: 0 })
    expect(await db.bonusTransaction.findUniqueOrThrow({ where: { idempotencyKey: `expire:${expiredLot}` } })).toMatchObject({
      type: 'expiration',
      amount: -70,
    })

    await runBonusExpirations(db, NOW, { apply: true })
    expect(await balanceOf(account.id)).toBe(30)
    expect(await db.bonusTransaction.count({ where: { idempotencyKey: `expire:${expiredLot}` } })).toBe(1)
  })

  it('сухой прогон без apply ничего не пишет: ни сгорания, ни начисления', async () => {
    const account = await makeAccount('dry')
    await seedLot(account.id, 50, daysFromNow(-2))
    const orderId = await makeDueOrder(account.userId as string, 20)
    const rowsBefore = await db.bonusTransaction.count({ where: { accountId: account.id } })

    const expired = await runBonusExpirations(db, NOW, { apply: false })
    const accrued = await runBonusAccruals(db, NOW, { apply: false })

    expect(expired.expiredPoints).toBeGreaterThanOrEqual(50)
    expect(accrued.due).toBeGreaterThanOrEqual(1)
    expect(accrued.accrued).toBe(0)
    expect(await balanceOf(account.id)).toBe(50)
    expect(await db.bonusTransaction.count({ where: { accountId: account.id } })).toBe(rowsBefore)
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).bonusAccruedAt).toBeNull()
  })

  it('начисление берёт только оплаченные заказы: неоплаченный не попадает в выборку и не начисляется', async () => {
    const account = await makeAccount('unpaid-due')
    const dueBefore = (await runBonusAccruals(db, NOW, { apply: false })).due
    const orderId = await makeDueOrder(account.userId as string, 10)
    await db.order.update({ where: { id: orderId }, data: { paymentStatus: 'pending' } })

    expect((await runBonusAccruals(db, NOW, { apply: false })).due).toBe(dueBefore)
    await runBonusAccruals(db, NOW, { apply: true })

    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).bonusAccruedAt).toBeNull()
    expect(await balanceOf(account.id)).toBe(0)
  })

  it('заказ участника, который вышел из клуба, не попадает в выборку и не начисляется', async () => {
    const dueBefore = (await runBonusAccruals(db, NOW, { apply: false })).due
    const account = await makeAccount('left-skipped')
    const orderId = await makeDueOrder(account.userId as string, 10)
    await bonusService.leave(account.userId as string, NOW)

    expect((await runBonusAccruals(db, NOW, { apply: false })).due).toBe(dueBefore)
    await runBonusAccruals(db, NOW, { apply: true })

    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).bonusAccruedAt).toBeNull()
    expect(await balanceOf(account.id)).toBe(0)
  })

  it('обезличивание: счёт удалённого пользователя отвязан, журнал на месте', async () => {
    const account = await makeAccount('anonymize')
    await seedLot(account.id, 40, null)
    const rowsBefore = await db.bonusTransaction.count({ where: { accountId: account.id } })
    await db.user.update({ where: { id: account.userId as string }, data: { deletedAt: NOW } })

    const result = await runBonusAnonymize(db, NOW, { apply: true })
    strayAccountIds.push(account.id)

    expect(result.anonymized).toBeGreaterThanOrEqual(1)
    expect(await db.bonusAccount.findUniqueOrThrow({ where: { id: account.id } })).toMatchObject({
      userId: null,
      anonymizedAt: expect.any(Date),
    })
    expect(await db.bonusTransaction.count({ where: { accountId: account.id } })).toBe(rowsBefore)
  })

  it('жёсткое удаление: запись согласия остаётся с userId = null, счёт отвязан', async () => {
    const account = await makeAccount('hard-delete')
    const userId = account.userId as string
    const consent = await db.consentRecord.findFirstOrThrow({ where: { userId, purpose: 'loyalty' } })
    strayConsentIds.push(consent.id)
    strayAccountIds.push(account.id)

    await db.user.delete({ where: { id: userId } })

    expect(await db.consentRecord.findUniqueOrThrow({ where: { id: consent.id } })).toMatchObject({
      userId: null,
      textVersion: consent.textVersion,
    })
    expect(await db.bonusAccount.findUniqueOrThrow({ where: { id: account.id } })).toMatchObject({ userId: null })
  })

  it('сверка: испорченный баланс даёт расхождение, после исправления расхождения нет', async () => {
    const account = await makeAccount('reconcile')
    await seedLot(account.id, 25, null)
    const baseline = (await reconcileBonusBalances(db)).mismatched

    await db.$executeRaw`UPDATE bonus_accounts SET balance = balance + 1 WHERE id = ${account.id}`
    expect((await reconcileBonusBalances(db)).mismatched).toBe(baseline + 1)

    await db.$executeRaw`UPDATE bonus_accounts SET balance = balance - 1 WHERE id = ${account.id}`
    expect((await reconcileBonusBalances(db)).mismatched).toBe(baseline)
  })

  it('выключенная программа: сгорание и начисления ничего не делают, сверка работает', async () => {
    const account = await makeAccount('disabled')
    await seedLot(account.id, 15, daysFromNow(-1))
    const orderId = await makeDueOrder(account.userId as string, 10)
    await setProgram(false)
    try {
      expect(await runBonusExpirations(db, NOW, { apply: true })).toMatchObject({ accounts: 0, expiredPoints: 0 })
      expect(await runBonusAccruals(db, NOW, { apply: true })).toMatchObject({ due: 0, accrued: 0 })
      expect(await balanceOf(account.id)).toBe(15)
      expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).bonusAccruedAt).toBeNull()
      expect(await reconcileBonusBalances(db)).toEqual({ mismatched: expect.any(Number) })
    } finally {
      await setProgram(true)
    }
  })

  it('выключенная программа: обезличивание всё равно выполняется (152-ФЗ), баланс и журнал не меняются', async () => {
    const account = await makeAccount('disabled-anonymize')
    await seedLot(account.id, 15, null)
    const rowsBefore = await db.bonusTransaction.count({ where: { accountId: account.id } })
    strayAccountIds.push(account.id)
    await db.user.update({ where: { id: account.userId as string }, data: { deletedAt: NOW } })
    await setProgram(false)
    try {
      const result = await runBonusAnonymize(db, NOW, { apply: true })

      expect(result.anonymized).toBeGreaterThanOrEqual(1)
      expect(await db.bonusAccount.findUniqueOrThrow({ where: { id: account.id } })).toMatchObject({
        userId: null,
        anonymizedAt: expect.any(Date),
        balance: 15,
      })
      expect(await db.bonusTransaction.count({ where: { accountId: account.id } })).toBe(rowsBefore)
    } finally {
      await setProgram(true)
    }
  })
})
