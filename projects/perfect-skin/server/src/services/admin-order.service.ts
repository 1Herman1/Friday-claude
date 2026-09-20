import { db, type Prisma, $Enums } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'

type OrderStatus = $Enums.OrderStatus
type PaymentStatus = $Enums.PaymentStatus
type UserRole = $Enums.UserRole

// Машина переходов статусов заказов
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ['confirmed', 'packed', 'in_transit', 'delivered', 'cancelled'],
  confirmed: ['packed', 'in_transit', 'delivered', 'cancelled'],
  packed: ['in_transit', 'delivered', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
}

interface ListOrdersQuery {
  status?: OrderStatus
  paymentStatus?: PaymentStatus
  dateFrom?: Date
  dateTo?: Date
  search?: string
  limit: number
  offset: number
}

interface UpdateOrderPayload {
  status?: OrderStatus
  deliveryTrackNumber?: string
  adminNote?: string
  markPaid?: boolean
}

export class AdminOrderService {
  async listOrders(query: ListOrdersQuery) {
    const where: Prisma.OrderWhereInput = {}

    if (query.status) {
      where.status = query.status
    }

    if (query.paymentStatus) {
      where.paymentStatus = query.paymentStatus
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {}
      if (query.dateFrom) {
        (where.createdAt as any).gte = query.dateFrom
      }
      if (query.dateTo) {
        (where.createdAt as any).lte = query.dateTo
      }
    }

    if (query.search) {
      where.number = {
        contains: query.search,
        mode: 'insensitive',
      }
    }

    const [items, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          user: {
            select: { name: true, phone: true, email: true },
          },
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      db.order.count({ where }),
    ])

    return {
      items: items.map((order) => this.formatAdminOrder(order)),
      total,
      limit: query.limit,
      offset: query.offset,
    }
  }

  async getOrder(id: string) {
    const order = await db.order.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, phone: true, email: true } },
        items: {
          include: {
            product: { select: { slug: true, images: true } },
          },
        },
        redemption: {
          include: { promoCode: { select: { code: true, percent: true } } },
        },
      },
    })

    if (!order) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден')
    }

    return this.formatAdminOrder(order)
  }

  async updateOrder(id: string, payload: UpdateOrderPayload, actorRole: UserRole) {
    const order = await db.order.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, phone: true, email: true } },
        items: {
          include: {
            product: { select: { slug: true, images: true } },
          },
        },
        redemption: {
          include: { promoCode: { select: { code: true, percent: true } } },
        },
      },
    })

    if (!order) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден')
    }

    // Validate status transition
    if (payload.status && payload.status !== order.status) {
      const allowed = ALLOWED_TRANSITIONS[order.status]

      // super_admin может делать любой переход, кроме из терминальных статусов
      if (actorRole === 'super_admin') {
        if ((order.status === 'delivered' || order.status === 'cancelled') &&
            (payload.status !== 'delivered' && payload.status !== 'cancelled')) {
          throw new ApiError(409, 'INVALID_STATUS_TRANSITION', 'Недопустимый переход статуса')
        }
      } else {
        // Остальные следуют машине переходов
        if (!allowed.includes(payload.status)) {
          throw new ApiError(409, 'INVALID_STATUS_TRANSITION', 'Недопустимый переход статуса')
        }
      }
    }

    const updateData: Prisma.OrderUpdateInput = {}

    if (payload.status) {
      updateData.status = payload.status
    }

    if (payload.deliveryTrackNumber !== undefined) {
      updateData.deliveryTrackNumber = payload.deliveryTrackNumber || null
    }

    if (payload.adminNote !== undefined) {
      updateData.adminNote = payload.adminNote || null
    }

    if (payload.markPaid) {
      updateData.paymentStatus = 'paid'
      updateData.paidAt = new Date()
    }

    const updated = await db.order.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { name: true, phone: true, email: true } },
        items: {
          include: {
            product: { select: { slug: true, images: true } },
          },
        },
        redemption: {
          include: { promoCode: { select: { code: true, percent: true } } },
        },
      },
    })

    return this.formatAdminOrder(updated)
  }

  private formatAdminOrder(order: any) {
    const items = order.items.map((item: any) => ({
      productName: item.productName,
      brandName: item.brandName,
      volumeLabel: item.volumeLabel,
      price: Number(item.price),
      quantity: item.quantity,
      lineTotal: Number(item.price) * item.quantity,
      productSlug: item.product?.slug ?? null,
      image: item.product?.images?.[0] ?? null,
    }))

    return {
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      deliveryTrackNumber: order.deliveryTrackNumber,
      adminNote: order.adminNote,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      deliveryMethod: order.deliveryMethod,
      cdekPvzCode: order.cdekPvzCode,
      deliveryAddress: order.deliveryAddress,
      user: {
        name: order.user?.name ?? null,
        phone: order.user?.phone ?? null,
        email: order.user?.email ?? null,
      },
      recipient: {
        name: order.recipientName,
        phone: order.recipientPhone,
        email: order.recipientEmail,
      },
      items,
      subtotal: Number(order.subtotal),
      promo: order.promoDiscount > 0
        ? {
            code: order.redemption?.promoCode?.code ?? '',
            percent: order.redemption?.promoCode?.percent ?? 0,
            discount: Number(order.promoDiscount),
            subtotal: Number(order.subtotal),
          }
        : null,
      deliveryCost: Number(order.deliveryCost),
      total: Number(order.total),
      comment: order.comment,
      paidAt: order.paidAt,
    }
  }
}

export const adminOrderService = new AdminOrderService()
