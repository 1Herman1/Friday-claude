import type { Prisma } from '@prisma/client'

/** Гость = строка users без email, телефона и пароля (guest-session.ts). Одно определение для users и dashboard. */
export const GUEST_USER_WHERE: Prisma.UserWhereInput = { email: null, phone: null, passwordHash: null }
export const REGISTERED_USER_WHERE: Prisma.UserWhereInput = {
  OR: [{ email: { not: null } }, { phone: { not: null } }, { passwordHash: { not: null } }],
}
export function isGuestUser(u: { email: string | null; phone: string | null; passwordHash: string | null }): boolean {
  return !u.email && !u.phone && !u.passwordHash
}

/** Предикат для поиска старых гостевых записей без взаимодействий (заказов, избранного, подборов) и без товаров в корзине. */
export function staleGuestWhere(days: number): Prisma.UserWhereInput {
  const threshold = new Date(Date.now() - days * 86400000)
  return {
    ...GUEST_USER_WHERE,
    createdAt: { lt: threshold },
    orders: { none: {} },
    favorites: { none: {} },
    quizSessions: { none: {} },
    OR: [
      { cart: null },
      { cart: { is: { items: { none: {} } } } },
    ],
  }
}
