import { FastifyPluginAsync } from 'fastify'
import { checkRole } from '../../middleware/check-role'

const dashboardRoute: FastifyPluginAsync = async (app) => {
  const guard = { preHandler: [app.authenticate, checkRole(['super_admin', 'orders_manager', 'products_manager'])] }

  app.get('/', guard, async (request, reply) => {
    const q = request.query as { period?: string }
    const periodType = q.period ?? 'month'

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    let periodStart: Date
    let periodEnd: Date

    if (periodType === 'week') {
      const dayOfWeek = now.getDay()
      const diff = now.getDate() - dayOfWeek
      periodStart = new Date(now.getFullYear(), now.getMonth(), diff)
      periodEnd = new Date(now)
    } else if (periodType === 'year') {
      periodStart = new Date(now.getFullYear(), 0, 1)
      periodEnd = new Date(now)
    } else if (periodType === 'today') {
      periodStart = todayStart
      periodEnd = new Date()
    } else {
      periodStart = monthStart
      periodEnd = new Date()
    }

    const [
      ordersToday,
      ordersMonth,
      revenueToday,
      revenueMonth,
      totalUsers,
      newUsersToday,
      totalProducts,
      recentOrders,
      ordersInPeriod,
      revenueInPeriod,
      newUsersInPeriod,
      visitsInPeriod,
      quizSessionsInPeriod,
    ] = await Promise.all([
      app.prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      app.prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
      app.prisma.order.aggregate({
        where: { createdAt: { gte: todayStart }, status: { not: 'cancelled' } },
        _sum: { total: true },
      }),
      app.prisma.order.aggregate({
        where: { createdAt: { gte: monthStart }, status: { not: 'cancelled' } },
        _sum: { total: true },
      }),
      app.prisma.user.count(),
      app.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      app.prisma.product.count({ where: { isActive: true } }),
      app.prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          items: true,
        },
      }),
      app.prisma.order.count({
        where: { createdAt: { gte: periodStart, lte: periodEnd } },
      }),
      app.prisma.order.aggregate({
        where: { createdAt: { gte: periodStart, lte: periodEnd }, status: { not: 'cancelled' } },
        _sum: { total: true },
      }),
      app.prisma.user.count({
        where: { createdAt: { gte: periodStart, lte: periodEnd } },
      }),
      app.prisma.siteVisit.aggregate({
        where: { day: { gte: periodStart, lte: periodEnd } },
        _sum: { count: true },
      }),
      app.prisma.quizSession.count({
        where: { createdAt: { gte: periodStart, lte: periodEnd } },
      }),
    ])

    // Build series data: bucketed by day (week/today/month) or by month (year)
    const series: { date: string; orders: number; revenue: number; visits: number }[] = []

    if (periodType === 'year') {
      // Monthly buckets
      let current = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1)
      while (current <= periodEnd) {
        const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1)
        const monthEnd = new Date(nextMonth.getTime() - 1)

        const monthOrders = await app.prisma.order.count({
          where: { createdAt: { gte: current, lte: monthEnd } },
        })

        const monthRevenue = await app.prisma.order.aggregate({
          where: { createdAt: { gte: current, lte: monthEnd }, status: { not: 'cancelled' } },
          _sum: { total: true },
        })

        const monthVisits = await app.prisma.siteVisit.aggregate({
          where: { day: { gte: current, lte: monthEnd } },
          _sum: { count: true },
        })

        series.push({
          date: current.toISOString().split('T')[0],
          orders: monthOrders,
          revenue: monthRevenue._sum.total ?? 0,
          visits: monthVisits._sum.count ?? 0,
        })

        current = nextMonth
      }
    } else {
      // Daily buckets for week/month/today
      let current = new Date(periodStart)
      while (current <= periodEnd) {
        const dayEnd = new Date(current)
        dayEnd.setDate(dayEnd.getDate() + 1)

        const dayOrders = await app.prisma.order.count({
          where: { createdAt: { gte: current, lt: dayEnd } },
        })

        const dayRevenue = await app.prisma.order.aggregate({
          where: { createdAt: { gte: current, lt: dayEnd }, status: { not: 'cancelled' } },
          _sum: { total: true },
        })

        const dayVisits = await app.prisma.siteVisit.findUnique({
          where: { day: current },
          select: { count: true },
        })

        series.push({
          date: current.toISOString().split('T')[0],
          orders: dayOrders,
          revenue: dayRevenue._sum.total ?? 0,
          visits: dayVisits?.count ?? 0,
        })

        current = dayEnd
      }
    }

    return reply.send({
      ordersToday,
      ordersMonth,
      revenueToday: revenueToday._sum.total ?? 0,
      revenueMonth: revenueMonth._sum.total ?? 0,
      totalUsers,
      newUsersToday,
      totalProducts,
      recentOrders,
      period: {
        from: periodStart.toISOString(),
        to: periodEnd.toISOString(),
        orders: ordersInPeriod,
        revenue: revenueInPeriod._sum.total ?? 0,
        newUsers: newUsersInPeriod,
        visits: visitsInPeriod._sum.count ?? 0,
        quizSessions: quizSessionsInPeriod,
        activeGuests: 0, // Будет рассчитано на фронте если нужно
      },
      series,
    })
  })
}

export default dashboardRoute
