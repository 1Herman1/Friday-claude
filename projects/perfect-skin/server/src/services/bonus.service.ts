import type * as PsShared from '@ps/shared'
import * as psSharedNs from '@ps/shared'
import { db, type Prisma, $Enums, type LoyaltySettings } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'
import { CONSENT_TEXT_VERSION } from '../lib/consents.js'
import { isWholesaleViewer, resolvePrice, STAFF_ROLES, type PriceViewer } from '../lib/pricing.js'
import { loyaltySettingsService } from './loyalty-settings.service.js'
import { promoService } from './promo.service.js'

// CJS-пакет: vitest кладёт экспорты в namespace, tsx — в default. Берём оба.
const shared = ((psSharedNs as { default?: typeof PsShared }).default ?? psSharedNs) as typeof PsShared

type Tx = Prisma.TransactionClient
type BonusTxType = $Enums.BonusTxType
type OrderStatus = $Enums.OrderStatus

export type CartOwner = { userId: string } | { sessionId: string }

export type BonusPlan = { accountId: string | null; spendPoints: number; spendDiscount: number; accrualPlanned: number }

export type BonusReason = 'PROGRAM_DISABLED' | 'AUTH_REQUIRED' | 'NOT_ELIGIBLE' | 'NOT_MEMBER' | 'PROMO_CONFLICT' | 'MIN_ORDER' | 'EMPTY_BALANCE'

export type BonusCheckoutQuote = {
  canSpend: boolean
  reason: BonusReason | null
  available: number
  maxSpend: number
  kopecksPerBonus: number
  goodsAfterDiscount: number
  minOrderForSpend: number
  accrualPreview: number
}

type PlanOrderBonusInput = {
  userId: string
  viewer: PriceViewer
  requestedPoints: number
  hasPromo: boolean
  subtotal: number
  promoDiscount: number
  items: { price: number; quantity: number; isProfessional: boolean }[]
  settings: LoyaltySettings
  now: Date
}

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

async function expireAccount(tx: Tx, accountId: string, now: Date): Promise<number> {
  await lockAccountById(tx, accountId)
  return expireDueLots(tx, accountId, now)
}

function spendRules(settings: LoyaltySettings): PsShared.BonusSpendRules {
  return {
    kopecksPerBonus: settings.kopecksPerBonus,
    maxSpendPercent: settings.maxSpendPercent,
    minOrderForSpend: settings.minOrderForSpend,
    allowSpendWithPromo: settings.allowSpendWithPromo,
  }
}

function accrualRules(settings: LoyaltySettings): PsShared.BonusAccrualRules {
  return {
    accrualPercent: settings.accrualPercent,
    accrualBase: settings.accrualBase,
    kopecksPerBonus: settings.kopecksPerBonus,
    excludeProfessionalProducts: settings.excludeProfessionalProducts,
    accrueWithPromo: settings.accrueWithPromo,
  }
}

// Баланс, который можно тратить сейчас: сумма живых партий, без чтения и блокировки счёта
async function liveBalance(client: Pick<Tx, 'bonusTransaction'>, accountId: string, now: Date): Promise<number> {
  const agg = await client.bonusTransaction.aggregate({
    where: {
      accountId,
      amount: { gt: 0 },
      remaining: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    _sum: { remaining: true },
  })
  return agg._sum.remaining ?? 0
}

export type BonusSummary = {
  programEnabled: boolean
  eligible: boolean
  member: boolean
  joinedAt: Date | null
  balance: number
  balanceValue: number
  nextExpiration: { amount: number; expiresAt: Date } | null
  rules: {
    accrualPercent: number
    accrualTrigger: LoyaltySettings['accrualTrigger']
    accrualDelayDays: number
    maxSpendPercent: number
    minOrderForSpend: number
    allowSpendWithPromo: boolean
    kopecksPerBonus: number
    bonusTtlDays: number
  }
  rulesVersion: string
}

export type CustomerBonusTx = {
  id: string
  type: BonusTxType
  amount: number
  remaining: number | null
  expiresAt: Date | null
  createdAt: Date
  orderNumber: string | null
}

async function getSummary(userId: string, viewer: PriceViewer, now: Date): Promise<BonusSummary> {
  const settings = await loyaltySettingsService.get()
  const account = await db.bonusAccount.findUnique({
    where: { userId },
    select: { id: true, joinedAt: true, leftAt: true },
  })
  const balance = account ? await liveBalance(db, account.id, now) : 0
  const nextLot = account
    ? await db.bonusTransaction.findFirst({
        where: { accountId: account.id, amount: { gt: 0 }, remaining: { gt: 0 }, expiresAt: { gt: now } },
        orderBy: { expiresAt: 'asc' },
        select: { remaining: true, expiresAt: true },
      })
    : null
  const member = Boolean(account && !account.leftAt)

  return {
    programEnabled: settings.enabled,
    eligible: isEligible(viewer),
    member,
    joinedAt: member && account ? account.joinedAt : null,
    balance,
    balanceValue: shared.bonusValue(balance, settings.kopecksPerBonus),
    nextExpiration: nextLot?.expiresAt ? { amount: nextLot.remaining ?? 0, expiresAt: nextLot.expiresAt } : null,
    rules: {
      accrualPercent: settings.accrualPercent,
      accrualTrigger: settings.accrualTrigger,
      accrualDelayDays: settings.accrualDelayDays,
      maxSpendPercent: settings.maxSpendPercent,
      minOrderForSpend: settings.minOrderForSpend,
      allowSpendWithPromo: settings.allowSpendWithPromo,
      kopecksPerBonus: settings.kopecksPerBonus,
      bonusTtlDays: settings.bonusTtlDays,
    },
    rulesVersion: CONSENT_TEXT_VERSION.loyalty,
  }
}

// reason и createdBy не отдаём: в них внутренняя заметка сотрудника
async function listTransactions(
  userId: string,
  page: { limit: number; offset: number }
): Promise<{ items: CustomerBonusTx[]; total: number }> {
  const account = await db.bonusAccount.findUnique({ where: { userId }, select: { id: true } })
  if (!account) return { items: [], total: 0 }

  const [rows, total] = await Promise.all([
    db.bonusTransaction.findMany({
      where: { accountId: account.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: page.offset,
      take: page.limit,
      select: {
        id: true,
        type: true,
        amount: true,
        remaining: true,
        expiresAt: true,
        createdAt: true,
        order: { select: { number: true } },
      },
    }),
    db.bonusTransaction.count({ where: { accountId: account.id } }),
  ])
  return {
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      amount: row.amount,
      remaining: row.remaining,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      orderNumber: row.order?.number ?? null,
    })),
    total,
  }
}

const BLOCK_REASON: Record<PsShared.BonusSpendBlock, BonusReason> = {
  PROMO_CONFLICT: 'PROMO_CONFLICT',
  MIN_ORDER: 'MIN_ORDER',
  EMPTY_BALANCE: 'EMPTY_BALANCE',
}

// Вызывается внутри транзакции заказа, после списания остатков (порядок блокировок: товары → счёт).
async function planOrderBonus(tx: Tx, input: PlanOrderBonusInput): Promise<BonusPlan> {
  const { settings, viewer, requestedPoints, now } = input
  const hasSpend = requestedPoints > 0
  const none: BonusPlan = { accountId: null, spendPoints: 0, spendDiscount: 0, accrualPlanned: 0 }

  if (!settings.enabled) {
    if (hasSpend) throw new ApiError(409, 'BONUS_PROGRAM_DISABLED', 'Бьюти-клуб пока не запущен')
    return none
  }
  if (hasSpend && !viewer) throw new ApiError(409, 'BONUS_AUTH_REQUIRED', 'Списание бонусов доступно после входа')
  if (viewer && !isEligible(viewer)) {
    if (hasSpend) throw new ApiError(409, 'BONUS_NOT_ELIGIBLE', 'Бьюти-клуб недоступен для этого аккаунта')
    return none
  }

  const account = hasSpend
    ? await lockAccountByUser(tx, input.userId)
    : await tx.bonusAccount.findUnique({
        where: { userId: input.userId },
        select: { id: true, balance: true, leftAt: true },
      })
  if (!account || account.leftAt) {
    if (hasSpend) throw new ApiError(409, 'BONUS_NOT_MEMBER', 'Вступите в Бьюти-клуб, чтобы списать бонусы')
    return none
  }

  const goodsAfterDiscount = input.subtotal - input.promoDiscount
  let spendDiscount = 0
  if (hasSpend) {
    await expireDueLots(tx, account.id, now)
    const available = (await tx.bonusAccount.findUniqueOrThrow({ where: { id: account.id }, select: { balance: true } })).balance
    const { maxSpend, block } = shared.calcMaxBonusSpend({
      goodsAfterDiscount,
      hasPromo: input.hasPromo,
      available,
      rules: spendRules(settings),
    })
    if (block === 'MIN_ORDER') {
      throw new ApiError(409, 'BONUS_MIN_ORDER', 'Для списания бонусов нужна большая сумма товаров', {
        minOrderForSpend: settings.minOrderForSpend,
      })
    }
    if (block === 'PROMO_CONFLICT') throw new ApiError(409, 'BONUS_PROMO_CONFLICT', 'Бонусы не суммируются с промокодом')
    if (block === 'EMPTY_BALANCE') throw new ApiError(409, 'BONUS_INSUFFICIENT', 'Недостаточно бонусов', { available })
    if (requestedPoints > maxSpend) {
      throw new ApiError(409, 'BONUS_LIMIT_EXCEEDED', 'Столько бонусов списать нельзя', { maxSpend })
    }
    spendDiscount = shared.bonusValue(requestedPoints, settings.kopecksPerBonus)
  }

  const accrualPlanned = shared.calcBonusAccrual({
    items: input.items,
    subtotal: input.subtotal,
    promoDiscount: input.promoDiscount,
    bonusDiscount: spendDiscount,
    hasPromo: input.hasPromo,
    rules: accrualRules(settings),
  })
  return { accountId: account.id, spendPoints: requestedPoints, spendDiscount, accrualPlanned }
}

// Чтение без блокировок: подсказка для чекаута, окончательную проверку делает заказ под блокировкой.
async function quoteForCart(
  owner: CartOwner,
  viewer: PriceViewer,
  promo: string | undefined,
  spend: number,
  now: Date
): Promise<BonusCheckoutQuote> {
  const settings = await loyaltySettingsService.get()
  const cart = await db.cart.findUnique({
    where: 'userId' in owner ? { userId: owner.userId } : { sessionId: owner.sessionId },
    include: { items: { include: { productVariant: { include: { product: true } } } } },
  })
  if (!cart || cart.items.length === 0) throw new ApiError(409, 'CART_EMPTY', 'Корзина пуста')

  const items = cart.items
    .map((item) => {
      const v = item.productVariant
      const price = resolvePrice({ retailPrice: v.retailPrice, wholesalePrice: v.wholesalePrice }, viewer)
      const available = v.isActive && !v.deletedAt && v.product.isActive && !v.product.deletedAt && price > 0
      return {
        price,
        quantity: item.quantity,
        isProfessional: v.product.isProfessional || v.isProfessional,
        available,
      }
    })
    .filter((item) => item.available)
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const promoDiscount = promo ? (await promoService.validateCode(promo, subtotal)).discount : 0
  const goodsAfterDiscount = subtotal - promoDiscount
  const base = {
    goodsAfterDiscount,
    minOrderForSpend: settings.minOrderForSpend,
    kopecksPerBonus: settings.kopecksPerBonus,
  }
  const rejected = (reason: BonusReason): BonusCheckoutQuote => ({
    ...base,
    canSpend: false,
    reason,
    available: 0,
    maxSpend: 0,
    accrualPreview: 0,
  })

  if (!settings.enabled) return rejected('PROGRAM_DISABLED')
  if (!viewer || !('userId' in owner)) return rejected('AUTH_REQUIRED')
  if (!isEligible(viewer)) return rejected('NOT_ELIGIBLE')

  const account = await db.bonusAccount.findUnique({
    where: { userId: owner.userId },
    select: { id: true, leftAt: true },
  })
  if (!account || account.leftAt) return rejected('NOT_MEMBER')

  const available = await liveBalance(db, account.id, now)
  const hasPromo = Boolean(promo)
  const { maxSpend, block } = shared.calcMaxBonusSpend({
    goodsAfterDiscount,
    hasPromo,
    available,
    rules: spendRules(settings),
  })
  const spendPoints = Math.min(Math.max(0, spend), maxSpend)
  const accrualPreview = shared.calcBonusAccrual({
    items: items.map(({ price, quantity, isProfessional }) => ({ price, quantity, isProfessional })),
    subtotal,
    promoDiscount,
    bonusDiscount: shared.bonusValue(spendPoints, settings.kopecksPerBonus),
    hasPromo,
    rules: accrualRules(settings),
  })
  return {
    ...base,
    canSpend: block === null && maxSpend > 0,
    reason: block ? BLOCK_REASON[block] : null,
    available,
    maxSpend,
    accrualPreview,
  }
}

function latestOf(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b
}

export const bonusService = {
  isEligible,
  getSummary,
  listTransactions,
  join,
  leave,
  spendForOrder,
  expireAccount,
  expireDueLots,
  planOrderBonus,
  quoteForCart,
  onOrderStatusChanged,
  onOrderPaid,
  accrueForOrder,
}
