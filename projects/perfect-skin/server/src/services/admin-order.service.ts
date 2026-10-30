import { db, type Prisma, $Enums } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'
import { changeOrderStatus, markOrderPaid } from './order-lifecycle.service.js'
import { toBonusView } from './order.service.js'
import { getCdek, getCdekSync } from './cdek/registry.js'

type OrderStatus = $Enums.OrderStatus
type PaymentStatus = $Enums.PaymentStatus
type UserRole = $Enums.UserRole
type CdekSyncState = $Enums.CdekSyncState

const CDEK_CLAIM_STALE_MS = 5 * 60_000
const CDEK_HISTORY_LIMIT = 50

interface CdekSubmitInput {
  deliveryMethod: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  cdekState: CdekSyncState | null
  cdekRequestedAt: Date | null
}

function cdekSubmittable(input: Omit<CdekSubmitInput, 'paymentStatus'>, now: Date): boolean {
  if (getCdek() === null || input.deliveryMethod === 'pickup') return false
  if (input.status === 'cancelled' || input.status === 'delivered') return false
  if (input.cdekState === null || input.cdekState === 'invalid') return true
  return (
    input.cdekState === 'creating' &&
    input.cdekRequestedAt !== null &&
    input.cdekRequestedAt.getTime() < now.getTime() - CDEK_CLAIM_STALE_MS
  )
}

export function cdekCanSubmit(input: CdekSubmitInput, now: Date): boolean {
  return input.paymentStatus === 'paid' && cdekSubmittable(input, now)
}

// Единственное, что мешает передаче, — неоплата: кнопку показываем неактивной с подсказкой.
export function cdekAwaitingPayment(input: CdekSubmitInput, now: Date): boolean {
  return input.paymentStatus !== 'paid' && cdekSubmittable(input, now)
}

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

interface CdekEventRow {
  code: string
  name: string | null
  city: string | null
  occurredAt: Date
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
        cdekEvents: { orderBy: { occurredAt: 'desc' }, take: CDEK_HISTORY_LIMIT },
      },
    })

    if (!order) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден')
    }

    return this.formatAdminOrder(order, order.cdekEvents)
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

    if (
      order.cdekNumber !== null &&
      payload.deliveryTrackNumber !== undefined &&
      (payload.deliveryTrackNumber || null) !== order.deliveryTrackNumber
    ) {
      throw new ApiError(409, 'TRACK_MANAGED_BY_CDEK', 'Трек-номер ведётся СДЭК, поменять его вручную нельзя')
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

    let becamePaid = false
    const updated = await db.$transaction(async (tx) => {
      const now = new Date()
      if (payload.status && payload.status !== order.status) {
        await changeOrderStatus(tx, { orderId: id, from: order.status, to: payload.status, now })
      }
      if (payload.markPaid) {
        becamePaid = await markOrderPaid(tx, { orderId: id, now })
      }

      const rest: Prisma.OrderUpdateInput = {}
      if (payload.deliveryTrackNumber !== undefined) {
        rest.deliveryTrackNumber = payload.deliveryTrackNumber || null
      }
      if (payload.adminNote !== undefined) {
        rest.adminNote = payload.adminNote || null
      }
      if (Object.keys(rest).length > 0) {
        await tx.order.update({ where: { id }, data: rest })
      }

      return tx.order.findUniqueOrThrow({
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
    })

    if (becamePaid) void getCdekSync()?.onOrderPaid(id)

    return this.formatAdminOrder(updated)
  }

  private formatAdminOrder(order: any, history: CdekEventRow[] = []) {
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
      deliveredAt: order.deliveredAt,
      bonus: toBonusView(order),
      bonusAccrualDueAt: order.bonusAccrualDueAt,
      cdek: {
        enabled: getCdek() !== null,
        state: order.cdekState ?? null,
        uuid: order.cdekUuid ?? null,
        number: order.cdekNumber ?? null,
        statusCode: order.cdekStatusCode ?? null,
        statusName: order.cdekStatusName ?? null,
        statusAt: order.cdekStatusAt ?? null,
        error: order.cdekError ?? null,
        tariffCode: order.cdekTariffCode ?? null,
        cityCode: order.cdekCityCode ?? null,
        point: order.deliveryPoint ?? null,
        quote: order.deliveryQuote ?? null,
        canSubmit: cdekCanSubmit(order, new Date()),
        awaitingPayment: cdekAwaitingPayment(order, new Date()),
        history: history.map((event) => ({
          code: event.code,
          name: event.name,
          city: event.city,
          occurredAt: event.occurredAt,
        })),
      },
    }
  }
}

export const adminOrderService = new AdminOrderService()
