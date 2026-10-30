import type { PrismaClient, Prisma } from './db.js'
import { bonusService } from '../services/bonus.service.js'
import { loyaltySettingsService } from '../services/loyalty-settings.service.js'

// Пакет на один прогон: остаток догонит следующая ночь
export const BONUS_BATCH = 500

export type AccrualResult = { due: number; accrued: number; skipped: number; failed: number }
export type ExpirationResult = { accounts: number; expiredPoints: number; failed: number }
export type AnonymizeResult = { anonymized: number }
export type ReconcileResult = { mismatched: number }

export function errorCode(err: unknown): string {
  return typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : 'unknown'
}

// Ночные задачи ничего не меняют, пока программа выключена; сверка работает всегда
async function isProgramEnabled(prisma: PrismaClient): Promise<boolean> {
  return (await loyaltySettingsService.get(prisma)).enabled
}

export async function runBonusAccruals(
  prisma: PrismaClient,
  now: Date,
  { apply }: { apply: boolean },
): Promise<AccrualResult> {
  if (!(await isProgramEnabled(prisma))) return { due: 0, accrued: 0, skipped: 0, failed: 0 }

  const due = await prisma.order.findMany({
    where: {
      bonusAccrualDueAt: { lte: now },
      bonusAccruedAt: null,
      bonusAccrualPlanned: { gt: 0 },
      paymentStatus: 'paid',
      status: { not: 'cancelled' },
    },
    select: { id: true },
    orderBy: { bonusAccrualDueAt: 'asc' },
    take: BONUS_BATCH,
  })
  const result: AccrualResult = { due: due.length, accrued: 0, skipped: 0, failed: 0 }
  if (!apply) return result

  for (const { id } of due) {
    try {
      const outcome = await prisma.$transaction((tx) => bonusService.accrueForOrder(tx, id, now))
      if (outcome === 'accrued') result.accrued += 1
      else result.skipped += 1
    } catch (err) {
      result.failed += 1
      console.error(`[bonus-jobs] accrual failed for order ${id}, code ${errorCode(err)}`)
    }
  }
  return result
}

export async function runBonusExpirations(
  prisma: PrismaClient,
  now: Date,
  { apply }: { apply: boolean },
): Promise<ExpirationResult> {
  if (!(await isProgramEnabled(prisma))) return { accounts: 0, expiredPoints: 0, failed: 0 }

  const expiredLots: Prisma.BonusTransactionWhereInput = {
    amount: { gt: 0 },
    remaining: { gt: 0 },
    expiresAt: { lte: now },
  }
  const accounts = await prisma.bonusTransaction.findMany({
    where: expiredLots,
    select: { accountId: true },
    distinct: ['accountId'],
    take: BONUS_BATCH,
  })

  if (!apply) {
    const sum = await prisma.bonusTransaction.aggregate({
      where: { ...expiredLots, accountId: { in: accounts.map((a) => a.accountId) } },
      _sum: { remaining: true },
    })
    return { accounts: accounts.length, expiredPoints: sum._sum.remaining ?? 0, failed: 0 }
  }

  const result: ExpirationResult = { accounts: accounts.length, expiredPoints: 0, failed: 0 }
  for (const { accountId } of accounts) {
    try {
      result.expiredPoints += await prisma.$transaction((tx) => bonusService.expireAccount(tx, accountId, now))
    } catch (err) {
      result.failed += 1
      console.error(`[bonus-jobs] expiration failed for account ${accountId}, code ${errorCode(err)}`)
    }
  }
  return result
}

// Счёт удалённого пользователя отвязывается от него, журнал остаётся без персональных данных.
// Не зависит от выключателя программы: обязанность 152-ФЗ, а не функция программы
export async function runBonusAnonymize(
  prisma: PrismaClient,
  now: Date,
  { apply }: { apply: boolean },
): Promise<AnonymizeResult> {
  const where: Prisma.BonusAccountWhereInput = {
    userId: { not: null },
    user: { deletedAt: { not: null } },
  }
  if (!apply) return { anonymized: await prisma.bonusAccount.count({ where }) }

  const res = await prisma.bonusAccount.updateMany({
    where,
    data: { userId: null, anonymizedAt: now },
  })
  return { anonymized: res.count }
}

// Сумма живых партий должна совпадать с балансом; расхождение — признак ошибки в коде или в базе
export async function reconcileBonusBalances(prisma: PrismaClient): Promise<ReconcileResult> {
  const [row] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM bonus_accounts a
    WHERE a.balance <> COALESCE((SELECT SUM(t.remaining) FROM bonus_transactions t WHERE t."accountId" = a.id AND t.amount > 0), 0)`
  return { mismatched: row?.n ?? 0 }
}
