import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import crypto from 'crypto'
import { db, $Enums } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'
import { bonusService } from '../services/bonus.service.js'
import { changeOrderStatus } from '../services/order-lifecycle.service.js'
import { adminOrderService } from '../services/admin-order.service.js'

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

async function makeUser(label: string) {
  return db.user.create({
    data: { email: `${label}-${runTag}${MAIL_DOMAIN}`, name: `Тест ${label}`, role: 'customer' },
  })
}

type OrderFixture = {
  status?: $Enums.OrderStatus
  subtotal?: number
  paymentStatus?: $Enums.PaymentStatus
  bonusSpent?: number
  bonusDiscount?: number
  bonusAccrualPlanned?: number
}

async function makeOrder(userId: string, fixture: OrderFixture = {}): Promise<string> {
  const order = await db.order.create({
    data: {
      number: `PS-BT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      userId,
      deliveryMethod: 'pickup',
      recipientName: 'Тест',
      recipientPhone: '+70000000000',
      subtotal: fixture.subtotal ?? 0,
      total: fixture.subtotal ?? 0,
      status: fixture.status ?? 'new',
      paymentStatus: fixture.paymentStatus,
      bonusSpent: fixture.bonusSpent ?? 0,
      bonusDiscount: fixture.bonusDiscount ?? 0,
      bonusAccrualPlanned: fixture.bonusAccrualPlanned ?? 0,
    },
  })
  return order.id
}

async function accountOf(userId: string) {
  return db.bonusAccount.findUniqueOrThrow({ where: { userId } })
}

async function balanceOf(userId: string): Promise<number> {
  return (await accountOf(userId)).balance
}

async function seedLot(accountId: string, amount: number, expiresAt: Date | null): Promise<void> {
  await db.bonusAccount.update({ where: { id: accountId }, data: { balance: { increment: amount } } })
  await db.bonusTransaction.create({
    data: { accountId, type: 'welcome', amount, remaining: amount, expiresAt },
  })
}

async function setProgram(accrualTrigger: $Enums.BonusAccrualTrigger): Promise<void> {
  await db.loyaltySettings.update({
    where: { id: 1 },
    data: { enabled: true, welcomeBonus: 0, accrualTrigger, accrualDelayDays: 0 },
  })
}

async function resetProgram(): Promise<void> {
  await db.loyaltySettings.update({
    where: { id: 1 },
    data: { enabled: false, welcomeBonus: 0, accrualTrigger: 'delivered', accrualDelayDays: 0 },
  })
}

function setStatus(orderId: string, status: $Enums.OrderStatus) {
  return adminOrderService.updateOrder(orderId, { status }, 'super_admin')
}

function codeOf(reason: unknown): string | undefined {
  return reason instanceof ApiError ? reason.code : undefined
}

describe('Жизненный цикл заказа и бонусы', () => {
  beforeAll(async () => {
    await cleanup()
    await setProgram('delivered')
  })

  afterAll(async () => {
    await cleanup()
    await resetProgram()
  })

  it('отмена заказа с бонусами возвращает списание один раз, срок возврата не короче 30 дней', async () => {
    const user = await makeUser('cancel-refund')
    await bonusService.join(user.id, VIEWER, new Date())
    const account = await accountOf(user.id)
    await seedLot(account.id, 100, new Date(Date.now() + 10 * DAY_MS))
    const orderId = await makeOrder(user.id, { status: 'confirmed', subtotal: 10_000, bonusSpent: 40, bonusDiscount: 4_000 })
    await db.$transaction((tx) =>
      bonusService.spendForOrder(tx, { accountId: account.id, orderId, points: 40, now: new Date() })
    )
    expect(await balanceOf(user.id)).toBe(60)

    const before = Date.now()
    await setStatus(orderId, 'cancelled')

    expect(await balanceOf(user.id)).toBe(100)
    const refunds = await db.bonusTransaction.findMany({ where: { orderId, type: 'order_spend_refund' } })
    expect(refunds).toHaveLength(1)
    expect(refunds[0].amount).toBe(40)
    expect(refunds[0].expiresAt?.getTime() ?? 0).toBeGreaterThanOrEqual(before + 30 * DAY_MS)
  })

  it('параллельная отмена одного заказа: один переход, ровно один возврат', async () => {
    const user = await makeUser('cancel-race')
    await bonusService.join(user.id, VIEWER, new Date())
    const account = await accountOf(user.id)
    await seedLot(account.id, 100, null)
    const orderId = await makeOrder(user.id, { status: 'delivered', subtotal: 10_000, bonusSpent: 40, bonusDiscount: 4_000 })
    await db.$transaction((tx) =>
      bonusService.spendForOrder(tx, { accountId: account.id, orderId, points: 40, now: new Date() })
    )

    const now = new Date()
    const results = await Promise.allSettled([
      db.$transaction((tx) => changeOrderStatus(tx, { orderId, from: 'delivered', to: 'cancelled', now })),
      db.$transaction((tx) => changeOrderStatus(tx, { orderId, from: 'delivered', to: 'cancelled', now })),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(rejected).toHaveLength(1)
    expect(codeOf(rejected[0].reason)).toBe('ORDER_STATUS_CONFLICT')
    expect(await db.bonusTransaction.count({ where: { orderId, type: 'order_spend_refund' } })).toBe(1)
    expect(await balanceOf(user.id)).toBe(100)
  })

  it('параллельные PATCH «отменить» через админку: возврат не дублируется', async () => {
    const user = await makeUser('patch-race')
    await bonusService.join(user.id, VIEWER, new Date())
    const account = await accountOf(user.id)
    await seedLot(account.id, 100, null)
    const orderId = await makeOrder(user.id, { status: 'delivered', subtotal: 10_000, bonusSpent: 20, bonusDiscount: 2_000 })
    await db.$transaction((tx) =>
      bonusService.spendForOrder(tx, { accountId: account.id, orderId, points: 20, now: new Date() })
    )

    const results = await Promise.allSettled([
      adminOrderService.updateOrder(orderId, { status: 'cancelled' }, 'super_admin'),
      adminOrderService.updateOrder(orderId, { status: 'cancelled' }, 'super_admin'),
    ])

    expect(results.some((r) => r.status === 'fulfilled')).toBe(true)
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(rejected.every((r) => codeOf(r.reason) === 'ORDER_STATUS_CONFLICT')).toBe(true)
    expect(await db.bonusTransaction.count({ where: { orderId, type: 'order_spend_refund' } })).toBe(1)
    expect(await balanceOf(user.id)).toBe(100)
  })

  it('отмена после начисления без трат: начисление отменяется целиком', async () => {
    const user = await makeUser('reverse-full')
    await bonusService.join(user.id, VIEWER, new Date())
    const orderId = await makeOrder(user.id, { status: 'in_transit', bonusAccrualPlanned: 50 })

    await setStatus(orderId, 'delivered')
    expect(await balanceOf(user.id)).toBe(50)

    await setStatus(orderId, 'cancelled')
    expect(await balanceOf(user.id)).toBe(0)
    const reversal = await db.bonusTransaction.findFirstOrThrow({ where: { orderId, type: 'order_accrual_reversal' } })
    expect(reversal.amount).toBe(-50)
    expect(reversal.reason).toBeNull()
  })

  it('отмена после начисления и траты: списывается не больше баланса, недостача в reason, баланс не в минусе', async () => {
    const user = await makeUser('reverse-partial')
    await bonusService.join(user.id, VIEWER, new Date())
    const account = await accountOf(user.id)
    const accrualOrder = await makeOrder(user.id, { status: 'in_transit', bonusAccrualPlanned: 50 })
    await setStatus(accrualOrder, 'delivered')
    expect(await balanceOf(user.id)).toBe(50)

    const spendOrder = await makeOrder(user.id, { status: 'new', subtotal: 10_000, bonusSpent: 40, bonusDiscount: 4_000 })
    await db.$transaction((tx) =>
      bonusService.spendForOrder(tx, { accountId: account.id, orderId: spendOrder, points: 40, now: new Date() })
    )
    expect(await balanceOf(user.id)).toBe(10)

    await setStatus(accrualOrder, 'cancelled')

    expect(await balanceOf(user.id)).toBe(0)
    const reversal = await db.bonusTransaction.findFirstOrThrow({ where: { orderId: accrualOrder, type: 'order_accrual_reversal' } })
    expect(reversal.amount).toBe(-10)
    expect(reversal.reason).toBe('не списано 40: бонусы уже потрачены')
  })

  it('начисление по оплате: при доставке без оплаты ничего, после оплаты — начислено', async () => {
    await setProgram('paid')
    try {
      const user = await makeUser('paid-trigger')
      await bonusService.join(user.id, VIEWER, new Date())
      const orderId = await makeOrder(user.id, { status: 'new', bonusAccrualPlanned: 50 })

      await setStatus(orderId, 'delivered')
      expect(await balanceOf(user.id)).toBe(0)
      expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).bonusAccruedAt).toBeNull()

      await adminOrderService.updateOrder(orderId, { markPaid: true }, 'super_admin')
      expect(await balanceOf(user.id)).toBe(50)
      const order = await db.order.findUniqueOrThrow({ where: { id: orderId } })
      expect(order.bonusAccruedAt).not.toBeNull()
      expect(order.paymentStatus).toBe('paid')
    } finally {
      await setProgram('delivered')
    }
  })

  it('вышедший из клуба не получает начисление; после повторного вступления оно начисляется', async () => {
    const user = await makeUser('left-member')
    const now = new Date()
    await bonusService.join(user.id, VIEWER, now)
    const orderId = await makeOrder(user.id, { status: 'in_transit', bonusAccrualPlanned: 50 })
    await bonusService.leave(user.id, now)

    await setStatus(orderId, 'delivered')
    expect(await balanceOf(user.id)).toBe(0)
    const pending = await db.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(pending.bonusAccruedAt).toBeNull()
    expect(pending.bonusAccrualDueAt).not.toBeNull()

    await bonusService.join(user.id, VIEWER, now)
    const outcome = await db.$transaction((tx) => bonusService.accrueForOrder(tx, orderId, new Date()))
    expect(outcome).toBe('accrued')
    expect(await balanceOf(user.id)).toBe(50)
  })
})
