import type { PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client'
import type { FastifyRequest } from 'fastify'

export const ANONYMIZED_NAME = 'Удалённый пользователь'

export class AccountNotFoundError extends Error {
  constructor(message: string, public alreadyDeleted = false) {
    super(message)
    this.name = 'AccountNotFoundError'
  }
}

export async function anonymizeUser(
  prisma: PrismaClient,
  userId: string,
  opts: { reason: 'self' | 'admin'; actorId?: string; ip?: string | null; userAgent?: string | null }
) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new AccountNotFoundError('Пользователь не найден', false)
  }
  if (user.deletedAt) {
    throw new AccountNotFoundError('Пользователь уже обезличен', true)
  }

  const textVersion = opts.reason === 'self' ? 'self' : `admin:${opts.actorId}`

  return prisma.$transaction(async (tx) => {
    // Delete addresses
    await tx.address.deleteMany({ where: { userId } })

    // Delete pets
    await tx.pet.deleteMany({ where: { userId } })

    // Delete OTP codes
    await tx.otpCode.deleteMany({ where: { userId } })

    // Delete favorites
    await tx.favorite.deleteMany({ where: { userId } })

    // Delete comparison
    await tx.comparison.deleteMany({ where: { userId } })

    // Delete cart items
    const cart = await tx.cart.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (cart) {
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } })
      await tx.cart.delete({ where: { id: cart.id } })
    }

    // Delete quiz sessions
    await tx.quizSession.deleteMany({ where: { userId } })

    // Delete subscriptions
    await tx.subscription.deleteMany({ where: { userId } })

    // Delete chat messages
    await tx.chatMessage.deleteMany({ where: { userId } })

    // Clear orders: set contact fields to null and delivery info to DbNull
    await tx.order.updateMany({
      where: { userId },
      data: {
        contactName: null,
        contactEmail: null,
        contactPhone: null,
        comment: null,
        deliveryAddress: Prisma.DbNull,
        deliveryPoint: Prisma.DbNull,
      },
    })

    // Reviews: delete pending/rejected, anonymize approved
    await tx.review.deleteMany({
      where: {
        userId,
        status: { not: 'approved' },
      },
    })

    await tx.review.updateMany({
      where: { userId, status: 'approved' },
      data: { authorName: 'Аноним' },
    })

    // Update user
    const now = new Date()
    await tx.user.update({
      where: { id: userId },
      data: {
        name: ANONYMIZED_NAME,
        email: null,
        phone: null,
        username: null,
        passwordHash: null,
        isActive: false,
        lastSeenAt: null,
        deletedAt: now,
      },
    })

    // Факт и редакция согласий остаются как доказательство, сетевые следы уходят
    await tx.consent.updateMany({ where: { userId }, data: { ip: null, userAgent: null } })

    await tx.consent.create({
      data: {
        userId,
        kind: 'withdrawal',
        textVersion,
        ip: opts.reason === 'admin' ? null : opts.ip || null,
        userAgent: opts.reason === 'admin' ? null : opts.userAgent || null,
      },
    })
  }, { timeout: 15000 })
}

export async function exportUserData(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      username: true,
      bonusPoints: true,
      bonusLevel: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      addresses: true,
      pets: true,
      orders: { include: { items: true }, orderBy: { createdAt: 'desc' } },
      subscriptions: {
        include: {
          product: { select: { name: true, slug: true } },
          productVariant: { select: { weight: true } },
        },
      },
      favorites: true,
      reviews: true,
      bonusTransactions: { orderBy: { createdAt: 'desc' } },
      quizSessions: true,
      consents: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!user) {
    throw new AccountNotFoundError('Пользователь не найден')
  }

  const { addresses, pets, orders, subscriptions, favorites, reviews, bonusTransactions, quizSessions, consents, ...profile } = user

  return {
    exportedAt: new Date().toISOString(),
    user: profile,
    addresses,
    pets,
    orders,
    subscriptions,
    favorites,
    reviews,
    bonusTransactions,
    quizSessions,
    consents,
  }
}
