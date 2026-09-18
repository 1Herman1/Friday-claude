import type { Prisma } from '@prisma/client'

/** Гость = строка users без email, телефона и пароля (guest-session.ts). Одно определение для users и dashboard. */
export const GUEST_USER_WHERE: Prisma.UserWhereInput = { email: null, phone: null, passwordHash: null, deletedAt: null }
export const REGISTERED_USER_WHERE: Prisma.UserWhereInput = {
  deletedAt: null,
  OR: [{ email: { not: null } }, { phone: { not: null } }, { passwordHash: { not: null } }],
}
export const DELETED_USER_WHERE: Prisma.UserWhereInput = { deletedAt: { not: null } }
export function isGuestUser(u: { email: string | null; phone: string | null; passwordHash: string | null; deletedAt?: Date | null }): boolean {
  return !u.email && !u.phone && !u.passwordHash && !u.deletedAt
}

/**
 * Предикат для поиска старых гостевых записей без взаимодействий (заказов, избранного, подборов) и без товаров в корзине.
 *
 * Отсчёт ведётся от последней активности (lastSeenAt), так как гостевой JWT живёт 30 дней — корзина
 * не должна исчезать у активного гостя. До выкатки этой фичи lastSeenAt был пуст; для таких записей
 * используется createdAt. Два условия OR обязаны быть в AND: если оставить их на одном уровне объекта,
 * второй OR молча перепишет первый — это частая ошибка.
 */
export function staleGuestWhere(days: number): Prisma.UserWhereInput {
  const threshold = new Date(Date.now() - days * 86400000)
  return {
    ...GUEST_USER_WHERE,
    orders: { none: {} },
    favorites: { none: {} },
    quizSessions: { none: {} },
    AND: [
      { OR: [{ lastSeenAt: { lt: threshold } }, { lastSeenAt: null, createdAt: { lt: threshold } }] },
      { OR: [{ cart: null }, { cart: { is: { items: { none: {} } } } }] },
    ],
  }
}
