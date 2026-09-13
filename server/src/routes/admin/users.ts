import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import * as bcrypt from 'bcryptjs'
import { checkRole } from '../../middleware/check-role'

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
      }
      const page = Math.max(1, parseInt(q.page ?? '1'))
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20')))
      const skip = (page - 1) * limit
      const type = q.type ?? 'registered'
      const sort = q.sort ?? 'created'

      const where: Record<string, unknown> = {}
      if (q.role) where.role = q.role
      if (q.search) {
        where.OR = [
          { name: { contains: q.search, mode: 'insensitive' } },
          { email: { contains: q.search, mode: 'insensitive' } },
          { phone: { contains: q.search } },
        ]
      }

      // Filter by type: registered, guests, or all
      if (type === 'registered') {
        // Has email or phone or passwordHash
        where.OR = [{ email: { not: null } }, { phone: { not: null } }, { passwordHash: { not: null } }]
      } else if (type === 'guests') {
        // No email, phone, or passwordHash AND has at least one interaction
        where.AND = [
          { email: null },
          { phone: null },
          { passwordHash: null },
          {
            OR: [
              { orders: { some: {} } },
              { cart: { is: { items: { some: {} } } } },
              { favorites: { some: {} } },
              { quizSessions: { some: {} } },
            ],
          },
        ]
      }

      const orderBy: any =
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
            _count: { select: { orders: true, favorites: true, quizSessions: true } },
            cart: { select: { items: { select: { id: true } } } },
          },
        }),
        app.prisma.user.count({ where }),
      ])

      const formattedItems = items.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        bonusPoints: u.bonusPoints,
        bonusLevel: u.bonusLevel,
        createdAt: u.createdAt,
        lastSeenAt: u.lastSeenAt,
        isGuest: !u.email && !u.phone,
        cartItems: u.cart?.items?.length ?? 0,
        _count: u._count,
      }))

      return reply.send({ items: formattedItems, total, page, totalPages: Math.ceil(total / limit) })
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
        data: { role: role as any },
        select: { id: true, name: true, email: true, phone: true, role: true, bonusPoints: true, bonusLevel: true, createdAt: true },
      })
      return reply.send(user)
    } catch (err: any) {
      if (err?.code === 'P2025') {
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
      } catch (err: any) {
        if (err?.code === 'P2025') {
          return reply.status(404).send({ error: 'Пользователь не найден' })
        }
        throw err
      }
    }
  )
}

export default usersAdminRoute
