import { db, $Enums } from '../lib/db.js'

type OrderStatus = $Enums.OrderStatus

export class AdminDashboardService {
  async getDashboardData() {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAgo = new Date(today)
    monthAgo.setDate(monthAgo.getDate() - 30)

    // Orders by status (all orders, any paymentStatus)
    const ordersByStatus = await db.order.groupBy({
      by: ['status'],
      _count: true,
    })

    const statusMap: Record<OrderStatus, number> = {
      new: 0,
      confirmed: 0,
      packed: 0,
      in_transit: 0,
      delivered: 0,
      cancelled: 0,
    }

    ordersByStatus.forEach((group) => {
      statusMap[group.status] = group._count
    })

    // Revenue: today, week, month (only paid orders, excluding cancelled)
    const paidOrdersWhere = {
      paymentStatus: 'paid' as const,
      status: { not: 'cancelled' as const },
    }

    const [revenueToday, revenueWeek, revenueMonth] = await Promise.all([
      db.order.aggregate({
        _sum: { total: true },
        where: { ...paidOrdersWhere, createdAt: { gte: today } },
      }),
      db.order.aggregate({
        _sum: { total: true },
        where: { ...paidOrdersWhere, createdAt: { gte: weekAgo } },
      }),
      db.order.aggregate({
        _sum: { total: true },
        where: { ...paidOrdersWhere, createdAt: { gte: monthAgo } },
      }),
    ])

    // Recent orders: last 10
    const recentOrders = await db.order.findMany({
      select: {
        id: true,
        number: true,
        createdAt: true,
        recipientName: true,
        total: true,
        status: true,
        paymentStatus: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // Low stock: variants with stock <= 3 and isActive
    const lowStockVariants = await db.productVariant.findMany({
      where: {
        stock: { lte: 3 },
        isActive: true,
      },
      select: {
        id: true,
        volumeLabel: true,
        stock: true,
        product: { select: { name: true } },
      },
      orderBy: { stock: 'asc' },
      take: 10,
    })

    // Sales by day: last 30 days
    const ordersLast30 = await db.order.findMany({
      where: {
        paymentStatus: 'paid',
        status: { not: 'cancelled' },
        createdAt: { gte: monthAgo },
      },
      select: {
        createdAt: true,
        total: true,
      },
    })

    // Group by date
    const salesByDayMap = new Map<string, { count: number; revenue: number }>()
    for (let i = 0; i < 30; i++) {
      const date = new Date(monthAgo)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      salesByDayMap.set(dateStr, { count: 0, revenue: 0 })
    }

    ordersLast30.forEach((order) => {
      const dateStr = order.createdAt.toISOString().split('T')[0]
      const entry = salesByDayMap.get(dateStr)
      if (entry) {
        entry.count += 1
        entry.revenue += order.total
      }
    })

    const salesByDay = Array.from(salesByDayMap.entries()).map(([date, data]) => ({
      date,
      ordersCount: data.count,
      revenue: data.revenue,
    }))

    return {
      ordersByStatus: statusMap,
      revenue: {
        today: revenueToday._sum.total || 0,
        week: revenueWeek._sum.total || 0,
        month: revenueMonth._sum.total || 0,
      },
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        number: order.number,
        createdAt: order.createdAt.toISOString(),
        recipientName: order.recipientName,
        total: order.total,
        status: order.status,
        paymentStatus: order.paymentStatus,
      })),
      lowStock: lowStockVariants.map((v) => ({
        variantId: v.id,
        productName: v.product.name,
        volumeLabel: v.volumeLabel || '',
        stock: v.stock,
      })),
      salesByDay,
    }
  }
}

export const adminDashboardService = new AdminDashboardService()
