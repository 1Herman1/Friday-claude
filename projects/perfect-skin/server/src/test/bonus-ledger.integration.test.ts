import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import crypto from 'crypto'
import { db } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'
import { CONSENT_TEXT_VERSION } from '../lib/consents.js'
import { bonusService } from '../services/bonus.service.js'
import { loyaltySettingsService } from '../services/loyalty-settings.service.js'

const MAIL_DOMAIN = '@ps-bonus-test.local'
const VIEWER = { role: 'customer', proStatus: 'none' }
const DAY_MS = 86_400_000
const runTag = crypto.randomUUID().slice(0, 8)

async function cleanup(): Promise<void> {
  const users = await db.user.findMany({ where: { email: { endsWith: MAIL_DOMAIN } }, select: { id: true } })
  const userIds = users.map((u) => u.id)
  if (userIds.length === 0) return
  const accounts = await db.bonusAccount.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
  const accountIds = accounts.map((a) => a.id)

  await db.bonusTransaction.deleteMany({ where: { accountId: { in: accountIds } } })
  await db.bonusAccount.deleteMany({ where: { id: { in: accountIds } } })
  await db.loyaltySettingsChange.deleteMany({ where: { changedById: { in: userIds } } })
  await db.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } })
  await db.promoCodeRedemption.deleteMany({ where: { userId: { in: userIds } } })
  await db.order.deleteMany({ where: { userId: { in: userIds } } })
  await db.cart.deleteMany({ where: { userId: { in: userIds } } })
  await db.consentRecord.deleteMany({ where: { userId: { in: userIds } } })
  await db.otpCode.deleteMany({ where: { userId: { in: userIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
}

async function setProgram(enabled: boolean, welcomeBonus: number): Promise<void> {
  await db.loyaltySettings.update({ where: { id: 1 }, data: { enabled, welcomeBonus } })
}

async function makeUser(label: string) {
  return db.user.create({
    data: { email: `${label}-${runTag}${MAIL_DOMAIN}`, name: `Тест ${label}`, role: 'customer' },
  })
}

async function makeOrder(userId: string): Promise<string> {
  const order = await db.order.create({
    data: {
      number: `PS-BT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      userId,
      deliveryMethod: 'pickup',
      recipientName: 'Тест',
      recipientPhone: '+70000000000',
      subtotal: 0,
      total: 0,
    },
  })
  return order.id
}

// Партия пополняет баланс так же, как credit() в сервисе.
async function seedLot(accountId: string, amount: number, expiresAt: Date | null): Promise<string> {
  await db.bonusAccount.update({ where: { id: accountId }, data: { balance: { increment: amount } } })
  const lot = await db.bonusTransaction.create({
    data: { accountId, type: 'welcome', amount, remaining: amount, expiresAt },
  })
  return lot.id
}

function spend(accountId: string, orderId: string, points: number, now: Date = new Date()): Promise<void> {
  return db.$transaction((tx) => bonusService.spendForOrder(tx, { accountId, orderId, points, now }))
}

function codeOf(reason: unknown): string | undefined {
  return reason instanceof ApiError ? reason.code : undefined
}

describe('Бонусный журнал: сервис', () => {
  beforeAll(async () => {
    await cleanup()
    await setProgram(true, 300)
  })

  afterAll(async () => {
    await cleanup()
    await setProgram(false, 0)
  })

  it('вступление создаёт счёт, согласие и приветственные один раз', async () => {
    const user = await makeUser('join-once')
    const now = new Date()

    await bonusService.join(user.id, VIEWER, now)
    const account = await db.bonusAccount.findUniqueOrThrow({ where: { userId: user.id } })
    expect(account.balance).toBe(300)

    const welcomes = await db.bonusTransaction.findMany({ where: { accountId: account.id, type: 'welcome' } })
    expect(welcomes).toHaveLength(1)
    expect(welcomes[0].expiresAt?.getTime()).toBe(now.getTime() + 60 * DAY_MS)

    const consents = await db.consentRecord.findMany({ where: { userId: user.id, purpose: 'loyalty' } })
    expect(consents).toHaveLength(1)
    expect(consents[0].textVersion).toBe(CONSENT_TEXT_VERSION.loyalty)

    await bonusService.join(user.id, VIEWER, now)
    expect((await db.bonusAccount.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(300)
    expect(await db.bonusTransaction.count({ where: { accountId: account.id, type: 'welcome' } })).toBe(1)
    expect(await db.consentRecord.count({ where: { userId: user.id, purpose: 'loyalty' } })).toBe(1)
  })

  it('пять параллельных вступлений дают один счёт, одно согласие и одно приветственное', async () => {
    const user = await makeUser('join-race')
    const now = new Date()

    await Promise.all(Array.from({ length: 5 }, () => bonusService.join(user.id, VIEWER, now)))

    expect(await db.bonusAccount.count({ where: { userId: user.id } })).toBe(1)
    expect(await db.consentRecord.count({ where: { userId: user.id, purpose: 'loyalty' } })).toBe(1)
    const account = await db.bonusAccount.findUniqueOrThrow({ where: { userId: user.id } })
    expect(await db.bonusTransaction.count({ where: { accountId: account.id, type: 'welcome' } })).toBe(1)
    expect(account.balance).toBe(300)
  })

  it('два параллельных списания на весь баланс: одно проходит, второе BONUS_INSUFFICIENT', async () => {
    const user = await makeUser('spend-race')
    const account = await db.bonusAccount.create({ data: { userId: user.id } })
    await seedLot(account.id, 100, null)
    const orders = [await makeOrder(user.id), await makeOrder(user.id)]

    const results = await Promise.allSettled(orders.map((orderId) => spend(account.id, orderId, 100)))

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(rejected).toHaveLength(1)
    expect(codeOf(rejected[0].reason)).toBe('BONUS_INSUFFICIENT')

    const after = await db.bonusAccount.findUniqueOrThrow({ where: { id: account.id } })
    expect(after.balance).toBe(0)
    const journal = await db.bonusTransaction.aggregate({ where: { accountId: account.id }, _sum: { amount: true } })
    expect(journal._sum.amount).toBe(after.balance)
  })

  it('десять параллельных списаний по 30 из 100: ровно три проходят, остаток 10', async () => {
    const user = await makeUser('spend-many')
    const account = await db.bonusAccount.create({ data: { userId: user.id } })
    await seedLot(account.id, 100, null)
    const orders = await Promise.all(Array.from({ length: 10 }, () => makeOrder(user.id)))

    const results = await Promise.allSettled(orders.map((orderId) => spend(account.id, orderId, 30)))

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3)
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(rejected.every((r) => codeOf(r.reason) === 'BONUS_INSUFFICIENT')).toBe(true)
    expect((await db.bonusAccount.findUniqueOrThrow({ where: { id: account.id } })).balance).toBe(10)
  })

  it('FIFO: сначала тратится партия, которая сгорает раньше', async () => {
    const user = await makeUser('fifo')
    const account = await db.bonusAccount.create({ data: { userId: user.id } })
    const now = new Date()
    const late = await seedLot(account.id, 60, new Date(now.getTime() + 30 * DAY_MS))
    const early = await seedLot(account.id, 40, new Date(now.getTime() + 5 * DAY_MS))
    const orderId = await makeOrder(user.id)

    await spend(account.id, orderId, 50, now)

    expect((await db.bonusTransaction.findUniqueOrThrow({ where: { id: early } })).remaining).toBe(0)
    expect((await db.bonusTransaction.findUniqueOrThrow({ where: { id: late } })).remaining).toBe(50)
    const spendRow = await db.bonusTransaction.findFirstOrThrow({ where: { orderId, type: 'order_spend' } })
    expect(spendRow.amount).toBe(-50)
    expect(spendRow.sourceMaxExpiresAt?.getTime()).toBe(now.getTime() + 30 * DAY_MS)
  })

  it('ленивое сгорание: просроченная партия не тратится, спенд сверх живого остатка — BONUS_INSUFFICIENT', async () => {
    const user = await makeUser('lazy-expiry')
    const account = await db.bonusAccount.create({ data: { userId: user.id } })
    const now = new Date()
    const expiredLot = await seedLot(account.id, 100, new Date(now.getTime() - DAY_MS))
    await seedLot(account.id, 20, new Date(now.getTime() + 10 * DAY_MS))
    const orderId = await makeOrder(user.id)

    const failed = spend(account.id, orderId, 50, now)
    await expect(failed).rejects.toThrow(ApiError)
    const reason = await failed.catch((e: unknown) => e)
    expect(codeOf(reason)).toBe('BONUS_INSUFFICIENT')
    expect(reason instanceof ApiError ? reason.details : undefined).toEqual({ available: 20 })

    expect((await db.bonusTransaction.findUniqueOrThrow({ where: { id: expiredLot } })).remaining).toBe(100)
    expect((await db.bonusAccount.findUniqueOrThrow({ where: { id: account.id } })).balance).toBe(120)

    await spend(account.id, orderId, 20, now)
    expect((await db.bonusTransaction.findUniqueOrThrow({ where: { id: expiredLot } })).remaining).toBe(0)
    expect((await db.bonusAccount.findUniqueOrThrow({ where: { id: account.id } })).balance).toBe(0)
  })

  it('CHECK не пускает минус на балансе и ручную корректировку без причины', async () => {
    const user = await makeUser('check')
    const account = await db.bonusAccount.create({ data: { userId: user.id } })

    await expect(
      db.$executeRaw`UPDATE bonus_accounts SET balance = -1 WHERE id = ${account.id}`
    ).rejects.toThrow()

    await expect(
      db.bonusTransaction.create({
        data: {
          accountId: account.id,
          type: 'manual_adjustment',
          amount: 5,
          remaining: 5,
          createdById: user.id,
          reason: null,
        },
      })
    ).rejects.toThrow()
  })

  it('чтение настроек не двигает updatedAt, иначе оптимистическая блокировка админки ломается', async () => {
    const first = await loyaltySettingsService.get()
    const second = await loyaltySettingsService.get()
    expect(second.updatedAt.getTime()).toBe(first.updatedAt.getTime())
  })
})
