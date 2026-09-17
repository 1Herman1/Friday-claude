import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import * as bcrypt from 'bcryptjs'
import { Prisma, UserRole } from '@prisma/client'
import { checkRole } from '../../middleware/check-role'
import { GUEST_USER_WHERE, REGISTERED_USER_WHERE, isGuestUser, staleGuestWhere } from '../../lib/user-type'
import { applyBonusChange, InsufficientBonusError } from '../../services/bonus.service'
import { anonymizeUser, AccountNotFoundError } from '../../services/account.service'

const usersAdminRoute: FastifyPluginAsync = async (app) => {
  const guard = { preHandler: [app.authenticate, checkRole(['super_admin'])] }

  app.get(
    '/',
    guard,
    async (request, reply) => {
      const q = request.query as {
        page?: string
        limit?: string
        search?: string
        role?: string
        type?: string
        sort?: string
        segment?: string
      }
      const page = Math.max(1, parseInt(q.page ?? '1'))
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20')))
      const skip = (page - 1) * limit
      const type = q.type ?? 'registered'
      const sort = q.sort ?? 'created'
      const segment = q.segment ?? ''

      // Build where clause with type, search, role, and segment filters
      const whereParts: Prisma.UserWhereInput[] = []

      // Type filter
      if (type === 'registered') {
        whereParts.push(REGISTERED_USER_WHERE)
      } else if (type === 'guests') {
        whereParts.push(GUEST_USER_WHERE)
        whereParts.push({
          OR: [
            { orders: { some: {} } },
            { cart: { is: { items: { some: {} } } } },
            { favorites: { some: {} } },
            { quizSessions: { some: {} } },
          ],
        })
      }

      // Role filter
      if (q.role) {
        whereParts.push({ role: { equals: q.role } } as Prisma.UserWhereInput)
      }

      // Search filter (name, email, phone)
      if (q.search) {
        whereParts.push({
          OR: [
            { name: { contains: q.search, mode: 'insensitive' } },
            { email: { contains: q.search, mode: 'insensitive' } },
            { phone: { contains: q.search } },
          ],
        })
      }

      // Segment filter
      if (segment === 'hasOrders') {
        whereParts.push({ orders: { some: {} } })
      } else if (segment === 'noOrders') {
        whereParts.push({ orders: { none: {} } })
      } else if (segment === 'inactive30d') {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
        whereParts.push({
          OR: [
            { lastSeenAt: null },
            { lastSeenAt: { lt: thirtyDaysAgo } },
          ],
        })
      } else if (segment === 'bonus1000plus') {
        whereParts.push({ bonusPoints: { gte: 1000 } })
      }

      // Combine all filters with AND
      const where = whereParts.length > 0 ? { AND: whereParts } : {}

      const orderBy: Prisma.UserOrderByWithRelationInput =
        sort === 'lastSeen'
          ? { lastSeenAt: 'desc' }
          : sort === 'orders'
            ? { orders: { _count: 'desc' } }
            : { createdAt: 'desc' }

      const [items, total] = await Promise.all([
        app.prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            bonusPoints: true,
            bonusLevel: true,
            createdAt: true,
            lastSeenAt: true,
            isActive: true,
            deletedAt: true,
            passwordHash: true,
            _count: { select: { orders: true, favorites: true, quizSessions: true } },
            cart: { select: { items: { select: { id: true } } } },
          },
        }),
        app.prisma.user.count({ where }),
      ])

      const formattedItems = items.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        bonusPoints: u.bonusPoints,
        bonusLevel: u.bonusLevel,
        createdAt: u.createdAt,
        lastSeenAt: u.lastSeenAt,
        isGuest: isGuestUser(u),
        isActive: u.isActive,
        isDeleted: !!u.deletedAt,
        deletedAt: u.deletedAt,
        cartItems: u.cart?.items?.length ?? 0,
        _count: u._count,
      }))

      return reply.send({ items: formattedItems, total, page, totalPages: Math.ceil(total / limit) })
    }
  )

  // Получить количество старых гостевых записей
  app.get(
    '/guests/stale',
    guard,
    async (request, reply) => {
      const q = request.query as { days?: string }
      const daysSchema = z.number().int().min(7).max(365).default(30)
      const days = daysSchema.parse(q.days ? parseInt(q.days) : 30)

      const count = await app.prisma.user.count({
        where: staleGuestWhere(days),
      })

      return reply.send({ days, count })
    }
  )

  // Удалить старые гостевые записи
  app.delete(
    '/guests/stale',
    guard,
    async (request, reply) => {
      const q = request.query as { days?: string }
      const daysSchema = z.number().int().min(7).max(365).default(30)
      const days = daysSchema.parse(q.days ? parseInt(q.days) : 30)

      const ids = await app.prisma.user.findMany({
        where: staleGuestWhere(days),
        select: { id: true },
      })

      let deleted = 0
      const batchSize = 500
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize).map(u => u.id)
        const result = await app.prisma.user.deleteMany({
          where: { id: { in: batch } },
        })
        deleted += result.count
      }

      return reply.send({ days, deleted })
    }
  )

  app.get<{ Params: { id: string } }>(
    '/:id',
    guard,
    async (request, reply) => {
      const { id } = request.params

      const [user, orders, stats, bonusTransactions, addresses, pets, subscriptions] = await Promise.all([
        app.prisma.user.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            passwordHash: true,
            role: true,
            bonusPoints: true,
            bonusLevel: true,
            isActive: true,
            deletedAt: true,
            welcomeBonusGranted: true,
            createdAt: true,
            lastSeenAt: true,
            _count: { select: { orders: true, favorites: true, quizSessions: true } },
            cart: { select: { items: { select: { id: true } } } },
          },
        }),
        app.prisma.order.findMany({
          where: { userId: id },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
            total: true,
            discount: true,
            promoCode: true,
            guestCheckout: true,
            createdAt: true,
            items: { select: { id: true } },
          },
        }),
        app.prisma.order.aggregate({
          where: { userId: id, paymentStatus: 'paid', status: { not: 'cancelled' } },
          _sum: { total: true },
          _count: true,
        }),
        app.prisma.bonusTransaction.findMany({
          where: { userId: id },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        app.prisma.address.findMany({
          where: { userId: id },
        }),
        app.prisma.pet.findMany({
          where: { userId: id },
        }),
        app.prisma.subscription.findMany({
          where: { userId: id },
          include: {
            product: { select: { name: true, slug: true } },
            productVariant: { select: { weight: true } },
          },
        }),
      ])

      if (!user) {
        return reply.status(404).send({ error: 'Пользователь не найден' })
      }

      const { passwordHash: _ph, ...userWithoutHash } = user
      const userResponse = {
        ...userWithoutHash,
        isGuest: isGuestUser(user),
        isDeleted: !!user.deletedAt,
      }

      return reply.send({
        user: userResponse,
        stats: {
          ordersCount: user._count.orders,
          paidOrdersCount: stats._count,
          paidTotal: stats._sum.total ?? 0,
          favoritesCount: user._count.favorites,
          quizSessions: user._count.quizSessions,
          cartItems: user.cart?.items?.length ?? 0,
        },
        orders,
        bonusTransactions,
        addresses,
        pets,
        subscriptions,
      })
    }
  )

  app.put<{ Params: { id: string } }>(
    '/:id/active',
    guard,
    async (request, reply) => {
      const { id } = request.params
      const bodySchema = z.object({
        isActive: z.boolean(),
      })

      const result = bodySchema.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message })
      }

      const { isActive } = result.data

      // Don't allow admin to block themselves
      const { userId } = request.user as { userId: string; role: string }
      if (id === userId && !isActive) {
        return reply.status(400).send({ error: 'Нельзя заблокировать себя' })
      }

      try {
        const user = await app.prisma.user.update({
          where: { id },
          // Блокировка гасит и уже выданные токены: иначе заблокированный
          // ходит по сайту до истечения недельного срока своего JWT
          data: isActive ? { isActive } : { isActive, sessionsValidFrom: new Date() },
          select: { id: true, isActive: true },
        })
        return reply.send(user)
      } catch (err: unknown) {
        if ((err as { code?: string })?.code === 'P2025') {
          return reply.status(404).send({ error: 'Пользователь не найден' })
        }
        throw err
      }
    }
  )

  app.post<{ Params: { id: string } }>(
    '/:id/bonus',
    guard,
    async (request, reply) => {
      const { id } = request.params
      const bodySchema = z.object({
        amount: z
          .number()
          .int()
          .min(-100000)
          .max(100000)
          .refine(a => a !== 0, 'Сумма не может быть нулём'),
        comment: z.string().trim().min(1, 'Укажите причину').max(200),
      })

      const result = bodySchema.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message })
      }

      const { amount, comment } = result.data

      try {
        const { balanceAfter, bonusLevel } = await app.prisma.$transaction(async (tx) => {
          return applyBonusChange(tx, {
            userId: id,
            amount,
            type: 'admin_adjust',
            comment: `Админ: ${comment}`,
            requireSufficient: amount < 0,
          })
        })

        return reply.send({ balanceAfter, bonusLevel })
      } catch (err: unknown) {
        if (err instanceof InsufficientBonusError) {
          return reply.status(409).send({ error: err.message })
        }
        if ((err as { code?: string })?.code === 'P2025') {
          return reply.status(404).send({ error: 'Пользователь не найден' })
        }
        throw err
      }
    }
  )

  app.put<{ Params: { id: string } }>('/:id/role', guard, async (request, reply) => {
    const { id } = request.params
    const { role } = request.body as { role: string }
    const validRoles = ['super_admin', 'orders_manager', 'products_manager', 'customer']
    if (!validRoles.includes(role)) return reply.status(400).send({ error: 'Invalid role' })

    try {
      const user = await app.prisma.user.update({
        where: { id },
        data: { role: role as UserRole },
        select: { id: true, name: true, email: true, phone: true, role: true, bonusPoints: true, bonusLevel: true, createdAt: true },
      })
      return reply.send(user)
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2025') {
        return reply.status(404).send({ error: 'Пользователь не найден' })
      }
      throw err
    }
  })

  const passwordSchema = z.object({
    newPassword: z.string().min(8, 'Пароль минимум 8 символов'),
  })

  app.put<{ Params: { id: string } }>(
    '/:id/password',
    guard,
    async (request, reply) => {
      const { id } = request.params
      const result = passwordSchema.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message })
      }

      const { newPassword } = result.data

      try {
        const passwordHash = await bcrypt.hash(newPassword, 10)
        await app.prisma.user.update({
          where: { id },
          data: { passwordHash },
        })
        return reply.send({ message: 'Пароль успешно сброшен' })
      } catch (err: unknown) {
        if ((err as { code?: string })?.code === 'P2025') {
          return reply.status(404).send({ error: 'Пользователь не найден' })
        }
        throw err
      }
    }
  )

  app.post<{ Params: { id: string } }>(
    '/:id/anonymize',
    guard,
    async (request, reply) => {
      const { id } = request.params
      const { userId: actorId } = request.user as { userId: string }

      if (id === actorId) {
        return reply.status(400).send({ error: 'Нельзя обезличить себя' })
      }
      const target = await app.prisma.user.findUnique({ where: { id }, select: { role: true } })
      if (target?.role === 'super_admin') {
        return reply.status(400).send({ error: 'Аккаунт администратора обезличить нельзя' })
      }

      try {
        await anonymizeUser(app.prisma, id, {
          reason: 'admin',
          actorId,
          ip: request.ip,
          userAgent: request.headers['user-agent'] || null,
        })

        return reply.send({ ok: true, alreadyDeleted: false })
      } catch (error) {
        if (error instanceof AccountNotFoundError) {
          if (error.alreadyDeleted) {
            return reply.send({ ok: true, alreadyDeleted: true })
          }
          return reply.status(404).send({ error: error.message })
        }
        throw error
      }
    }
  )
}

export default usersAdminRoute
