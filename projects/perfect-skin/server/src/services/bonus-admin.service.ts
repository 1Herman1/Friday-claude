import { db, type Prisma } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'
import { ADMIN_TX_SELECT, toAdminTx, type AdminBonusTx } from './bonus.service.js'

export type AdminBonusAccount = {
  userId: string
  name: string
  email: string | null
  phone: string | null
  balance: number
  member: boolean
  joinedAt: Date
  leftAt: Date | null
}

export async function listBonusAccounts(query: {
  search?: string
  limit: number
  offset: number
}): Promise<{ items: AdminBonusAccount[]; total: number }> {
  const where: Prisma.BonusAccountWhereInput = {
    userId: { not: null },
    ...(query.search
      ? {
          user: {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
            ],
          },
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.bonusAccount.findMany({
      where,
      orderBy: [{ joinedAt: 'desc' }, { id: 'asc' }],
      skip: query.offset,
      take: query.limit,
      select: {
        userId: true,
        balance: true,
        joinedAt: true,
        leftAt: true,
        user: { select: { name: true, email: true, phone: true } },
      },
    }),
    db.bonusAccount.count({ where }),
  ])

  return {
    items: rows.map((row) => ({
      userId: row.userId ?? '',
      name: row.user?.name ?? '',
      email: row.user?.email ?? null,
      phone: row.user?.phone ?? null,
      balance: row.balance,
      member: row.leftAt === null,
      joinedAt: row.joinedAt,
      leftAt: row.leftAt,
    })),
    total,
  }
}

export async function getBonusAccount(
  userId: string,
  page: { limit: number; offset: number },
  now: Date
): Promise<{
  account: AdminBonusAccount
  nextExpiration: { amount: number; expiresAt: Date } | null
  transactions: AdminBonusTx[]
  total: number
}> {
  const account = await db.bonusAccount.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      balance: true,
      joinedAt: true,
      leftAt: true,
      user: { select: { name: true, email: true, phone: true } },
    },
  })
  if (!account) throw new ApiError(404, 'BONUS_ACCOUNT_NOT_FOUND', 'Счёт не найден')

  const [nextLot, rows, total] = await Promise.all([
    db.bonusTransaction.findFirst({
      where: { accountId: account.id, amount: { gt: 0 }, remaining: { gt: 0 }, expiresAt: { gt: now } },
      orderBy: { expiresAt: 'asc' },
      select: { remaining: true, expiresAt: true },
    }),
    db.bonusTransaction.findMany({
      where: { accountId: account.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: page.offset,
      take: page.limit,
      select: ADMIN_TX_SELECT,
    }),
    db.bonusTransaction.count({ where: { accountId: account.id } }),
  ])

  return {
    account: {
      userId: account.userId ?? userId,
      name: account.user?.name ?? '',
      email: account.user?.email ?? null,
      phone: account.user?.phone ?? null,
      balance: account.balance,
      member: account.leftAt === null,
      joinedAt: account.joinedAt,
      leftAt: account.leftAt,
    },
    nextExpiration: nextLot?.expiresAt ? { amount: nextLot.remaining ?? 0, expiresAt: nextLot.expiresAt } : null,
    transactions: rows.map(toAdminTx),
    total,
  }
}
