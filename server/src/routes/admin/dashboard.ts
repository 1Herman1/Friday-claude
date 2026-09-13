import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { checkRole } from '../../middleware/check-role'
import { GUEST_USER_WHERE, REGISTERED_USER_WHERE } from '../../lib/user-type'
import { mskDayStart, mskDateKey, mskDayAsDate } from '../../lib/msk-time'

const dashboardRoute: FastifyPluginAsync = async (app) => {
  const guard = { preHandler: [app.authenticate, checkRole(['super_admin', 'orders_manager', 'products_manager'])] }

  const querySchema = z.object({
    period: z.enum(['today', 'week', 'month', 'year']).default('month'),
    userType: z.enum(['all', 'registered', 'guest']).default('all'),
  })

  app.get('/', guard, async (request, reply) => {
    const parsed = querySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Некорректные параметры' })
    }
    const { period: periodType, userType } = parsed.data

    const now = new Date()
    // Сутки магазина — московские (UTC+3). Все граница периода и графики считаются в них.
    // Historical SiteVisit до этого изменения — UTC дни (одна граница переброса, приемлемо).
    const todayStart = mskDayStart(now)
    const periodEnd = now

    // Calculate period boundaries (subtract milliseconds, not setDate)
    let periodStart: Date
    if (periodType === 'today') {
      periodStart = todayStart
    } else if (periodType === 'week') {
      periodStart = new Date(todayStart.getTime() - 6 * 864e5)
    } else if (periodType === 'month') {
      periodStart = new Date(todayStart.getTime() - 29 * 864e5)
    } else {
      // year
      periodStart = new Date(todayStart.getTime() - 364 * 864e5)
    }

    const monthStart = new Date(todayStart.getTime() - 29 * 864e5)

    // Filters
    const orderTypeWhere: Prisma.OrderWhereInput =
      userType === 'guest'
        ? { guestCheckout: true }
        : userType === 'registered'
          ? { guestCheckout: false }
          : {}

    const paidWhere: Prisma.OrderWhereInput = { paymentStatus: 'paid', status: { not: 'cancelled' } }
    const countWhere: Prisma.OrderWhereInput = { status: { not: 'cancelled' } }

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
      ordersTodayBreakdownRaw,
    ] = await Promise.all([
      app.prisma.order.count({ where: { createdAt: { gte: todayStart }, ...countWhere, ...orderTypeWhere } }),
      app.prisma.order.count({ where: { createdAt: { gte: monthStart }, ...countWhere, ...orderTypeWhere } }),
      app.prisma.order.aggregate({
        where: { createdAt: { gte: todayStart }, ...paidWhere, ...orderTypeWhere },
        _sum: { total: true },
      }),
      app.prisma.order.aggregate({
        where: { createdAt: { gte: monthStart }, ...paidWhere, ...orderTypeWhere },
        _sum: { total: true },
      }),
      app.prisma.user.count({ where: REGISTERED_USER_WHERE }),
      app.prisma.user.count({
        where: { createdAt: { gte: todayStart }, ...(userType === 'guest' ? GUEST_USER_WHERE : userType === 'registered' ? REGISTERED_USER_WHERE : {}) },
      }),
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
        where: { createdAt: { gte: periodStart, lte: periodEnd }, ...countWhere, ...orderTypeWhere },
      }),
      app.prisma.order.aggregate({
        where: { createdAt: { gte: periodStart, lte: periodEnd }, ...paidWhere, ...orderTypeWhere },
        _sum: { total: true },
      }),
      app.prisma.user.count({
        where: {
          createdAt: { gte: periodStart, lte: periodEnd },
          ...(userType === 'guest' ? GUEST_USER_WHERE : userType === 'registered' ? REGISTERED_USER_WHERE : {}),
        },
      }),
      app.prisma.siteVisit.aggregate({
        where: { day: { gte: mskDayAsDate(periodStart), lte: mskDayAsDate(periodEnd) } },
        _sum: { count: true },
      }),
      app.prisma.quizSession.count({
        where: { createdAt: { gte: periodStart, lte: periodEnd } },
      }),
      app.prisma.order.groupBy({
        by: ['paymentMethod', 'paymentStatus'],
        where: { createdAt: { gte: todayStart }, status: { not: 'cancelled' }, ...orderTypeWhere },
        _count: { _all: true },
        _sum: { total: true },
      }),
    ])

    // Build ordersTodayBreakdown
    const breakdown = {
      paidCard: { count: 0, sum: 0 },
      paidCash: { count: 0, sum: 0 },
      unpaid: { count: 0, sum: 0 },
      refunded: { count: 0, sum: 0 },
    }

    for (const row of ordersTodayBreakdownRaw) {
      const count = row._count._all
      const sum = row._sum.total ?? 0

      if (row.paymentStatus === 'refunded') {
        breakdown.refunded.count += count
        breakdown.refunded.sum += sum
      } else if (row.paymentStatus === 'paid') {
        if (row.paymentMethod === 'card') {
          breakdown.paidCard.count += count
          breakdown.paidCard.sum += sum
        } else if (row.paymentMethod === 'cash_on_delivery') {
          breakdown.paidCash.count += count
          breakdown.paidCash.sum += sum
        }
      } else {
        // pending, failed, etc.
        breakdown.unpaid.count += count
        breakdown.unpaid.sum += sum
      }
    }

    // Build series data with raw SQL
    // "createdAt" хранится в UTC; смещаем на +3 часа перед date_trunc чтобы считать дни и месяцы по московскому времени
    const bucket = periodType === 'year' ? 'month' : 'day'
    const rawRows = await app.prisma.$queryRaw<
      Array<{ bucket: Date; orders: number; revenue: number }>
    >`
      SELECT date_trunc(${Prisma.raw(`'${bucket}'`)}, "createdAt" + interval '3 hours') AS bucket,
             COUNT(*)::int AS orders,
             COALESCE(SUM(CASE WHEN "paymentStatus" = 'paid' THEN total ELSE 0 END), 0)::int AS revenue
      FROM "orders"
      WHERE "createdAt" >= ${periodStart} AND "createdAt" <= ${periodEnd} AND status <> 'cancelled'
        ${userType === 'guest' ? Prisma.sql`AND "guestCheckout" = true` : userType === 'registered' ? Prisma.sql`AND "guestCheckout" = false` : Prisma.empty}
      GROUP BY 1
      ORDER BY 1
    `

    // Query visits separately and group by bucket
    // SiteVisit.day now stores Moscow dates (UTC midnight), so filter with Date type
    const visitRows = await app.prisma.siteVisit.findMany({
      where: { day: { gte: mskDayAsDate(periodStart), lte: mskDayAsDate(periodEnd) } },
    })

    // Convert raw bucket dates to strings for mapping (they are already shifted to Moscow time)
    const seriesMap = new Map<string, { orders: number; revenue: number; visits: number }>()
    for (const row of rawRows) {
      const bucketStr = row.bucket.toISOString().slice(0, 10)
      seriesMap.set(bucketStr, {
        orders: row.orders,
        revenue: row.revenue,
        visits: 0,
      })
    }

    // Add visits, grouped by bucket (SiteVisit.day is Moscow date as UTC midnight, no shift needed)
    const visitMap = new Map<string, number>()
    for (const visit of visitRows) {
      const visitDate = visit.day.toISOString().slice(0, 10)
      const bucketDate =
        periodType === 'year'
          ? visitDate.slice(0, 7) + '-01' // YYYY-MM-01 for year
          : visitDate
      visitMap.set(bucketDate, (visitMap.get(bucketDate) ?? 0) + visit.count)
    }

    // Merge visits into series
    for (const [bucketStr, visits] of visitMap.entries()) {
      if (seriesMap.has(bucketStr)) {
        seriesMap.get(bucketStr)!.visits = visits
      } else {
        seriesMap.set(bucketStr, { orders: 0, revenue: 0, visits })
      }
    }

    // Generate all buckets in the period and fill gaps using Moscow date keys
    const series: Array<{ date: string; orders: number; revenue: number; visits: number }> = []

    if (periodType === 'year') {
      // Monthly buckets: generate using Moscow month keys
      const startKey = mskDateKey(periodStart)
      const endKey = mskDateKey(periodEnd)
      const startYear = parseInt(startKey.slice(0, 4))
      const startMonth = parseInt(startKey.slice(5, 7))
      const endYear = parseInt(endKey.slice(0, 4))
      const endMonth = parseInt(endKey.slice(5, 7))

      let y = startYear
      let m = startMonth

      while (y < endYear || (y === endYear && m <= endMonth)) {
        const bucketKey = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
        series.push({
          date: bucketKey,
          orders: seriesMap.get(bucketKey)?.orders ?? 0,
          revenue: seriesMap.get(bucketKey)?.revenue ?? 0,
          visits: seriesMap.get(bucketKey)?.visits ?? 0,
        })
        m++
        if (m > 12) {
          m = 1
          y++
        }
      }
    } else {
      // Daily buckets using Moscow date keys
      let current = periodStart
      const endDate = periodEnd

      while (current <= endDate) {
        const dateStr = mskDateKey(current)
        const data = seriesMap.get(dateStr)
        series.push({
          date: dateStr,
          orders: data?.orders ?? 0,
          revenue: data?.revenue ?? 0,
          visits: data?.visits ?? 0,
        })
        current = new Date(current.getTime() + 864e5)
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
      },
      series,
      ordersTodayBreakdown: breakdown,
      filters: { period: periodType, userType },
    })
  })
}

export default dashboardRoute
