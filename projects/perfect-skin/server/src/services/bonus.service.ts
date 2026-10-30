import { db, type Prisma, $Enums } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'
import { CONSENT_TEXT_VERSION } from '../lib/consents.js'
import { isWholesaleViewer, STAFF_ROLES, type PriceViewer } from '../lib/pricing.js'
import { loyaltySettingsService } from './loyalty-settings.service.js'

type Tx = Prisma.TransactionClient
type BonusTxType = $Enums.BonusTxType
type OrderStatus = $Enums.OrderStatus

type LockedAccount = { id: string; balance: number; leftAt: Date | null }

type Lot = { id: string; remaining: number; expiresAt: Date | null }

type CreditInput = {
  accountId: string
  type: BonusTxType
  amount: number
  expiresAt: Date | null
  orderId?: string
  idempotencyKey?: string
  reason?: string
  createdById?: string
}

type DebitInput = {
  accountId: string
  type: BonusTxType
  amount: number
  now: Date
  orderId?: string
  idempotencyKey?: string
  reason?: string
  createdById?: string
  preferLotId?: string
}

const DAY_MS = 86_400_000

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

function isEligible(viewer: PriceViewer): boolean {
  if (!viewer) return false
  return !isWholesaleViewer(viewer) && !STAFF_ROLES.includes(viewer.role)
}

// Инвариант порядка блокировок: сначала остатки товаров, потом счёт.
// Строка счёта — единственное место сериализации операций одного покупателя.
async function lockAccountByUser(tx: Tx, userId: string): Promise<LockedAccount | null> {
  const rows = await tx.$queryRaw<LockedAccount[]>`SELECT id, balance, "leftAt" FROM bonus_accounts WHERE "userId" = ${userId} FOR UPDATE`
  return rows[0] ?? null
}

async function lockAccountById(tx: Tx, id: string): Promise<LockedAccount> {
  const rows = await tx.$queryRaw<LockedAccount[]>`SELECT id, balance, "leftAt" FROM bonus_accounts WHERE id = ${id} FOR UPDATE`
  const account = rows[0]
  if (!account) throw new Error(`bonus account ${id} not found`)
  return account
}

// Вызывающий держит блокировку счёта.
async function credit(tx: Tx, input: CreditInput): Promise<void> {
  await tx.bonusAccount.update({
    where: { id: input.accountId },
    data: { balance: { increment: input.amount } },
  })
  await tx.bonusTransaction.create({
    data: {
      accountId: input.accountId,
      type: input.type,
      amount: input.amount,
      remaining: input.amount,
      expiresAt: input.expiresAt,
      orderId: input.orderId,
      idempotencyKey: input.idempotencyKey,
      reason: input.reason,
      createdById: input.createdById,
    },
  })
}

// Вызывающий держит блокировку счёта. Сначала сгорает просроченное, потом списание
// идёт только по живым партиям: баланс без них не должен попасть в трату.
async function debit(tx: Tx, input: DebitInput): Promise<string> {
  await expireDueLots(tx, input.accountId, input.now)

  const guard = await tx.bonusAccount.updateMany({
    where: { id: input.accountId, balance: { gte: input.amount } },
    data: { balance: { decrement: input.amount } },
  })
  if (guard.count === 0) {
    const account = await tx.bonusAccount.findUniqueOrThrow({
      where: { id: input.accountId },
      select: { balance: true },
    })
    throw new ApiError(409, 'BONUS_INSUFFICIENT', 'Недостаточно бонусов', { available: account.balance })
  }

  const spent: Lot[] = []
  let left = input.amount
  for (const lot of await liveLots(tx, input.accountId, input.now, input.preferLotId)) {
    if (left === 0) break
    const take = Math.min(lot.remaining, left)
    const res = await tx.bonusTransaction.updateMany({
      where: { id: lot.id, remaining: { gte: take } },
      data: { remaining: { decrement: take } },
    })
    if (res.count !== 1) throw new Error('bonus ledger drift')
    left -= take
    spent.push(lot)
  }
  if (left > 0) throw new Error('bonus ledger drift')

  const row = await tx.bonusTransaction.create({
    data: {
      accountId: input.accountId,
      type: input.type,
      amount: -input.amount,
      orderId: input.orderId,
      idempotencyKey: input.idempotencyKey,
      reason: input.reason,
      createdById: input.createdById,
      sourceMaxExpiresAt: latestExpiry(spent),
    },
    select: { id: true },
  })
  return row.id
}

async function liveLots(tx: Tx, accountId: string, now: Date, preferLotId?: string): Promise<Lot[]> {
  const lots = await tx.bonusTransaction.findMany({
    where: {
      accountId,
      amount: { gt: 0 },
      remaining: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    select: { id: true, remaining: true, expiresAt: true },
  })
  const ordered = lots.map((lot) => ({ id: lot.id, remaining: lot.remaining ?? 0, expiresAt: lot.expiresAt }))
  if (!preferLotId) return ordered
  return [...ordered.filter((lot) => lot.id === preferLotId), ...ordered.filter((lot) => lot.id !== preferLotId)]
}

// null, если среди потраченных партий была бессрочная.
function latestExpiry(lots: Lot[]): Date | null {
  let latest: Date | null = null
  for (const lot of lots) {
    if (lot.expiresAt === null) return null
    if (latest === null || lot.expiresAt.getTime() > latest.getTime()) latest = lot.expiresAt
  }
  return latest
}

// Вызывающий держит блокировку счёта. Возвращает сумму сгоревших баллов.
async function expireDueLots(tx: Tx, accountId: string, now: Date): Promise<number> {
  const lots = await tx.bonusTransaction.findMany({
    where: { accountId, amount: { gt: 0 }, remaining: { gt: 0 }, expiresAt: { lte: now } },
    select: { id: true, remaining: true },
  })

  let expired = 0
  for (const lot of lots) {
    const remaining = lot.remaining ?? 0
    await tx.bonusTransaction.create({
      data: { accountId, type: 'expiration', amount: -remaining, idempotencyKey: `expire:${lot.id}` },
    })
    const res = await tx.bonusTransaction.updateMany({
      where: { id: lot.id, remaining },
      data: { remaining: 0 },
    })
    if (res.count !== 1) throw new Error('bonus ledger drift')
    expired += remaining
  }

  if (expired > 0) {
    const res = await tx.bonusAccount.updateMany({
      where: { id: accountId, balance: { gte: expired } },
      data: { balance: { decrement: expired } },
    })
    if (res.count !== 1) throw new Error('bonus ledger drift')
  }
  return expired
}

async function join(userId: string, viewer: PriceViewer, now: Date): Promise<void> {
  const settings = await loyaltySettingsService.get()
  if (!settings.enabled) throw new ApiError(409, 'BONUS_PROGRAM_DISABLED', 'Бьюти-клуб пока не запущен')
  if (!isEligible(viewer)) throw new ApiError(409, 'BONUS_NOT_ELIGIBLE', 'Бьюти-клуб недоступен для этого аккаунта')

  await db.$transaction(async (tx) => {
    await tx.bonusAccount.upsert({ where: { userId }, create: { userId }, update: { leftAt: null } })
    const account = await lockAccountByUser(tx, userId)
    if (!account) throw new Error('bonus account missing after upsert')

    const activeConsent = await tx.consentRecord.findFirst({
      where: { userId, purpose: 'loyalty', textVersion: CONSENT_TEXT_VERSION.loyalty, revokedAt: null },
      select: { id: true },
    })
    if (!activeConsent) {
      await tx.consentRecord.create({
        data: { userId, purpose: 'loyalty', textVersion: CONSENT_TEXT_VERSION.loyalty, grantedAt: now },
      })
    }

    if (settings.welcomeBonus > 0) {
      const idempotencyKey = `welcome:${userId}`
      const existing = await tx.bonusTransaction.findUnique({ where: { idempotencyKey }, select: { id: true } })
      if (!existing) {
        await credit(tx, {
          accountId: account.id,
          type: 'welcome',
          amount: settings.welcomeBonus,
          expiresAt: addDays(now, settings.welcomeTtlDays),
          idempotencyKey,
        })
      }
    }
  })
}

async function leave(userId: string, now: Date): Promise<void> {
  await db.$transaction(async (tx) => {
    const account = await lockAccountByUser(tx, userId)
    if (!account || account.leftAt) return

    await tx.bonusAccount.update({ where: { id: account.id }, data: { leftAt: now } })
    await tx.consentRecord.updateMany({
      where: { userId, purpose: 'loyalty', revokedAt: null },
      data: { revokedAt: now },
    })
  })
}

async function spendForOrder(
  tx: Tx,
  input: { accountId: string; orderId: string; points: number; now: Date }
): Promise<void> {
  await lockAccountById(tx, input.accountId)
  await debit(tx, {
    accountId: input.accountId,
    type: 'order_spend',
    amount: input.points,
    now: input.now,
    orderId: input.orderId,
  })
}

async function scheduleAccrual(tx: Tx, orderId: string, now: Date, delayDays: number): Promise<void> {
  await tx.order.updateMany({
    where: { id: orderId, bonusAccrualDueAt: null, bonusAccrualPlanned: { gt: 0 } },
    data: { bonusAccrualDueAt: addDays(now, delayDays) },
  })
  if (delayDays === 0) await accrueForOrder(tx, orderId, now)
}

async function accrueForOrder(tx: Tx, orderId: string, now: Date): Promise<'accrued' | 'skipped'> {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { status: true, paymentStatus: true, userId: true, bonusAccruedAt: true, bonusAccrualPlanned: true },
  })
  if (
    order.status === 'cancelled' ||
    order.paymentStatus !== 'paid' ||
    order.bonusAccruedAt !== null ||
    order.bonusAccrualPlanned === 0
  ) {
    return 'skipped'
  }

  const account = await lockAccountByUser(tx, order.userId)
  if (!account || account.leftAt) return 'skipped'

  const existing = await tx.bonusTransaction.findFirst({
    where: { orderId, type: 'order_accrual' },
    select: { id: true },
  })
  if (!existing) {
    const settings = await loyaltySettingsService.get(tx)
    await credit(tx, {
      accountId: account.id,
      type: 'order_accrual',
      amount: order.bonusAccrualPlanned,
      expiresAt: settings.bonusTtlDays === 0 ? null : addDays(now, settings.bonusTtlDays),
      orderId,
    })
  }
  await tx.order.updateMany({ where: { id: orderId, bonusAccruedAt: null }, data: { bonusAccruedAt: now } })
  return 'accrued'
}

async function refundSpend(tx: Tx, orderId: string, now: Date, refundMinTtlDays: number): Promise<void> {
  const spend = await tx.bonusTransaction.findFirst({
    where: { orderId, type: 'order_spend' },
    select: { accountId: true, amount: true, sourceMaxExpiresAt: true },
  })
  if (!spend) return

  await lockAccountById(tx, spend.accountId)
  const refunded = await tx.bonusTransaction.findFirst({
    where: { orderId, type: 'order_spend_refund' },
    select: { id: true },
  })
  if (refunded) return

  const expiresAt = spend.sourceMaxExpiresAt === null
    ? null
    : latestOf(spend.sourceMaxExpiresAt, addDays(now, refundMinTtlDays))
  await credit(tx, {
    accountId: spend.accountId,
    type: 'order_spend_refund',
    amount: -spend.amount,
    expiresAt,
    orderId,
  })
}

async function reverseAccrual(tx: Tx, orderId: string, now: Date): Promise<void> {
  const accrual = await tx.bonusTransaction.findFirst({
    where: { orderId, type: 'order_accrual' },
    select: { id: true, accountId: true, amount: true },
  })
  if (!accrual) return

  await lockAccountById(tx, accrual.accountId)
  const reversed = await tx.bonusTransaction.findFirst({
    where: { orderId, type: 'order_accrual_reversal' },
    select: { id: true },
  })
  if (reversed) return

  await expireDueLots(tx, accrual.accountId, now)
  const account = await tx.bonusAccount.findUniqueOrThrow({
    where: { id: accrual.accountId },
    select: { balance: true },
  })
  const amount = Math.min(accrual.amount, account.balance)
  if (amount <= 0) return

  await debit(tx, {
    accountId: accrual.accountId,
    type: 'order_accrual_reversal',
    amount,
    now,
    orderId,
    preferLotId: accrual.id,
    reason: amount < accrual.amount ? `не списано ${accrual.amount - amount}: бонусы уже потрачены` : undefined,
  })
}

async function onOrderStatusChanged(
  tx: Tx,
  input: { orderId: string; from: OrderStatus; to: OrderStatus; now: Date }
): Promise<void> {
  const settings = await loyaltySettingsService.get(tx)
  if (input.to === 'delivered' && settings.accrualTrigger === 'delivered') {
    await scheduleAccrual(tx, input.orderId, input.now, settings.accrualDelayDays)
  }
  if (input.to === 'cancelled') {
    await refundSpend(tx, input.orderId, input.now, settings.refundMinTtlDays)
    await reverseAccrual(tx, input.orderId, input.now)
  }
}

// Начисление без оплаты пропускается, поэтому уже доставленный заказ, оплаченный позже, начисляем здесь.
async function onOrderPaid(tx: Tx, input: { orderId: string; now: Date }): Promise<void> {
  const settings = await loyaltySettingsService.get(tx)
  const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId }, select: { status: true } })
  const deliveredEarlier = settings.accrualTrigger === 'delivered' && order.status === 'delivered'
  if (settings.accrualTrigger === 'paid' || deliveredEarlier) {
    await scheduleAccrual(tx, input.orderId, input.now, settings.accrualDelayDays)
  }
}

function latestOf(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b
}

export const bonusService = {
  isEligible,
  join,
  leave,
  spendForOrder,
  expireDueLots,
  onOrderStatusChanged,
  onOrderPaid,
  accrueForOrder,
}
