import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { checkRole } from '../../middleware/check-role'
import { GUEST_USER_WHERE, REGISTERED_USER_WHERE } from '../../lib/user-type'

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
    const dayStartUtc = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    const todayStart = dayStartUtc(now)
    const periodEnd = now

    // Calculate period boundaries
    let periodStart: Date
    if (periodType === 'today') {
      periodStart = todayStart
    } else if (periodType === 'week') {
      const sevenDaysAgo = new Date(todayStart)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
      periodStart = sevenDaysAgo
    } else if (periodType === 'month') {
      const thirtyDaysAgo = new Date(todayStart)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
      periodStart = thirtyDaysAgo
    } else {
      // year
      const year364DaysAgo = new Date(todayStart)
      year364DaysAgo.setDate(year364DaysAgo.getDate() - 364)
      periodStart = year364DaysAgo
    }

    const monthStart = new Date(todayStart)
    monthStart.setDate(monthStart.getDate() - 29)

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
        where: { day: { gte: periodStart, lte: periodEnd } },
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
    const bucket = periodType === 'year' ? 'month' : 'day'
    const rawRows = await app.prisma.$queryRaw<
      Array<{ bucket: Date; orders: number; revenue: number }>
    >`
      SELECT date_trunc(${Prisma.raw(`'${bucket}'`)}, "createdAt") AS bucket,
             COUNT(*)::int AS orders,
             COALESCE(SUM(CASE WHEN "paymentStatus" = 'paid' THEN total ELSE 0 END), 0)::int AS revenue
      FROM "orders"
      WHERE "createdAt" >= ${periodStart} AND "createdAt" <= ${periodEnd} AND status <> 'cancelled'
        ${userType === 'guest' ? Prisma.sql`AND "guestCheckout" = true` : userType === 'registered' ? Prisma.sql`AND "guestCheckout" = false` : Prisma.empty}
      GROUP BY 1
      ORDER BY 1
    `
    // "createdAt" уже TIMESTAMP(3) в UTC; AT TIME ZONE преобразует в timestamptz, дальше date_trunc считает в SESSION timezone (может сдвинуть на день)

    // Query visits separately and group by bucket
    const visitRows = await app.prisma.siteVisit.findMany({
      where: { day: { gte: periodStart, lte: periodEnd } },
    })

    // Convert raw bucket dates to strings for mapping
    const seriesMap = new Map<string, { orders: number; revenue: number; visits: number }>()
    for (const row of rawRows) {
      const bucketStr = row.bucket.toISOString().slice(0, 10)
      seriesMap.set(bucketStr, {
        orders: row.orders,
        revenue: row.revenue,
        visits: 0,
      })
    }

    // Add visits, grouped by bucket
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

    // Generate all buckets in the period and fill gaps
    const series: Array<{ date: string; orders: number; revenue: number; visits: number }> = []

    if (periodType === 'year') {
      // Monthly buckets: generate explicitly to avoid day-of-month overflow
      let y = periodStart.getUTCFullYear()
      let m = periodStart.getUTCMonth()
      const endYear = periodEnd.getUTCFullYear()
      const endMonth = periodEnd.getUTCMonth()

      while (y < endYear || (y === endYear && m <= endMonth)) {
        const bucketKey = `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-01`
        series.push({
          date: bucketKey,
          orders: seriesMap.get(bucketKey)?.orders ?? 0,
          revenue: seriesMap.get(bucketKey)?.revenue ?? 0,
          visits: seriesMap.get(bucketKey)?.visits ?? 0,
        })
        m++
        if (m > 11) {
          m = 0
          y++
        }
      }
    } else {
      // Daily buckets
      let current = periodStart
      const endDate = periodEnd

      while (current <= endDate) {
        const dateStr = current.toISOString().slice(0, 10)
        const data = seriesMap.get(dateStr)
        series.push({
          date: dateStr,
          orders: data?.orders ?? 0,
          revenue: data?.revenue ?? 0,
          visits: data?.visits ?? 0,
        })
        current.setDate(current.getDate() + 1)
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
