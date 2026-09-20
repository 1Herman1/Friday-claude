import { db, type Prisma } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'

interface CreatePartnerPayload {
  name: string
  contact?: string
  commissionPercent: number
}

interface UpdatePartnerPayload {
  name?: string
  contact?: string
  commissionPercent?: number
  isActive?: boolean
}

interface CreatePromoCodePayload {
  code: string
  percent: number
  partnerId?: string
  maxRedemptions?: number
  minOrderAmount?: number
  startsAt?: Date
  expiresAt?: Date
}

interface UpdatePromoCodePayload {
  percent?: number
  partnerId?: string | null
  isActive?: boolean
  maxRedemptions?: number | null
  minOrderAmount?: number | null
  startsAt?: Date
  expiresAt?: Date
}

interface PartnerReportRow {
  partnerId: string
  partnerName: string
  commissionPercent: number
  ordersCount: number
  paidOrdersCount: number
  revenue: number // копейки
  clientDiscount: number // копейки
  payout: number // копейки
}

export class AdminPromoService {
  /**
   * Список всех партнёров с количеством их промокодов
   */
  async listPartners() {
    const partners = await db.partner.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        promoCodes: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    })

    return partners.map((partner) => ({
      id: partner.id,
      name: partner.name,
      contact: partner.contact || null,
      commissionPercent: partner.commissionPercent,
      isActive: partner.isActive,
      codesCount: partner.promoCodes.length,
      createdAt: partner.createdAt,
      updatedAt: partner.updatedAt,
    }))
  }

  /**
   * Создание партнёра
   */
  async createPartner(payload: CreatePartnerPayload) {
    // Проверка уникальности имени
    const existing = await db.partner.findUnique({
      where: { name: payload.name },
    })
    if (existing) {
      throw new ApiError(409, 'PARTNER_EXISTS', 'Партнёр с таким именем уже существует')
    }

    const partner = await db.partner.create({
      data: {
        name: payload.name,
        contact: payload.contact,
        commissionPercent: payload.commissionPercent,
      },
    })

    return {
      id: partner.id,
      name: partner.name,
      contact: partner.contact,
      commissionPercent: partner.commissionPercent,
      isActive: partner.isActive,
      codesCount: 0,
      createdAt: partner.createdAt,
      updatedAt: partner.updatedAt,
    }
  }

  /**
   * Обновление партнёра
   */
  async updatePartner(id: string, payload: UpdatePartnerPayload) {
    const partner = await db.partner.findUnique({ where: { id } })
    if (!partner) {
      throw new ApiError(404, 'PARTNER_NOT_FOUND', 'Партнёр не найден')
    }

    // Если меняем имя, проверим уникальность
    if (payload.name && payload.name !== partner.name) {
      const existing = await db.partner.findUnique({
        where: { name: payload.name },
      })
      if (existing) {
        throw new ApiError(409, 'PARTNER_EXISTS', 'Партнёр с таким именем уже существует')
      }
    }

    const updated = await db.partner.update({
      where: { id },
      data: {
        ...(payload.name !== undefined && { name: payload.name }),
        ...(payload.contact !== undefined && { contact: payload.contact }),
        ...(payload.commissionPercent !== undefined && {
          commissionPercent: payload.commissionPercent,
        }),
        ...(payload.isActive !== undefined && { isActive: payload.isActive }),
      },
      include: {
        promoCodes: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    })

    return {
      id: updated.id,
      name: updated.name,
      contact: updated.contact,
      commissionPercent: updated.commissionPercent,
      isActive: updated.isActive,
      codesCount: updated.promoCodes.length,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    }
  }

  /**
   * Список промокодов админа
   */
  async listPromoCodes() {
    const codes = await db.promoCode.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        partner: {
          select: { id: true, name: true },
        },
      },
    })

    return codes.map((code) => ({
      id: code.id,
      code: code.code,
      percent: code.percent,
      partner: code.partner
        ? { id: code.partner.id, name: code.partner.name }
        : null,
      maxRedemptions: code.maxRedemptions,
      usedCount: code.usedCount,
      minOrderAmount: code.minOrderAmount,
      startsAt: code.startsAt,
      expiresAt: code.expiresAt,
      isActive: code.isActive,
      createdAt: code.createdAt,
    }))
  }

  /**
   * Создание промокода
   */
  async createPromoCode(payload: CreatePromoCodePayload) {
    // Валидация кода
    if (!this.isValidPromoCode(payload.code)) {
      throw new ApiError(400, 'INVALID_CODE', 'Код должен содержать 3-20 символов буквы и цифры')
    }

    // Проверка уникальности кода (с учётом deleted)
    const existing = await db.promoCode.findFirst({
      where: { code: payload.code.toUpperCase() },
    })
    if (existing) {
      throw new ApiError(409, 'PROMO_CODE_EXISTS', 'Код уже используется')
    }

    // Если указан partnerId, проверим что партнёр существует
    if (payload.partnerId) {
      const partner = await db.partner.findUnique({
        where: { id: payload.partnerId },
      })
      if (!partner) {
        throw new ApiError(404, 'PARTNER_NOT_FOUND', 'Партнёр не найден')
      }
    }

    const promoCode = await db.promoCode.create({
      data: {
        code: payload.code.toUpperCase(),
        percent: payload.percent,
        partnerId: payload.partnerId,
        maxRedemptions: payload.maxRedemptions,
        minOrderAmount: payload.minOrderAmount,
        startsAt: payload.startsAt,
        expiresAt: payload.expiresAt,
      },
      include: {
        partner: {
          select: { id: true, name: true },
        },
      },
    })

    return {
      id: promoCode.id,
      code: promoCode.code,
      percent: promoCode.percent,
      partner: promoCode.partner
        ? { id: promoCode.partner.id, name: promoCode.partner.name }
        : null,
      maxRedemptions: promoCode.maxRedemptions,
      usedCount: promoCode.usedCount,
      minOrderAmount: promoCode.minOrderAmount,
      startsAt: promoCode.startsAt,
      expiresAt: promoCode.expiresAt,
      isActive: promoCode.isActive,
      createdAt: promoCode.createdAt,
    }
  }

  /**
   * Обновление промокода
   */
  async updatePromoCode(id: string, payload: UpdatePromoCodePayload) {
    const promoCode = await db.promoCode.findUnique({ where: { id } })
    if (!promoCode || promoCode.deletedAt) {
      throw new ApiError(404, 'PROMO_CODE_NOT_FOUND', 'Промокод не найден')
    }

    // Если меняется partnerId, проверим существование
    if (payload.partnerId !== undefined) {
      if (payload.partnerId) {
        const partner = await db.partner.findUnique({
          where: { id: payload.partnerId },
        })
        if (!partner) {
          throw new ApiError(404, 'PARTNER_NOT_FOUND', 'Партнёр не найден')
        }
      }
    }

    const updated = await db.promoCode.update({
      where: { id },
      data: {
        ...(payload.percent !== undefined && { percent: payload.percent }),
        ...(payload.partnerId !== undefined && { partnerId: payload.partnerId }),
        ...(payload.isActive !== undefined && { isActive: payload.isActive }),
        ...(payload.maxRedemptions !== undefined && {
          maxRedemptions: payload.maxRedemptions,
        }),
        ...(payload.minOrderAmount !== undefined && {
          minOrderAmount: payload.minOrderAmount,
        }),
        ...(payload.startsAt !== undefined && { startsAt: payload.startsAt }),
        ...(payload.expiresAt !== undefined && { expiresAt: payload.expiresAt }),
      },
      include: {
        partner: {
          select: { id: true, name: true },
        },
      },
    })

    return {
      id: updated.id,
      code: updated.code,
      percent: updated.percent,
      partner: updated.partner
        ? { id: updated.partner.id, name: updated.partner.name }
        : null,
      maxRedemptions: updated.maxRedemptions,
      usedCount: updated.usedCount,
      minOrderAmount: updated.minOrderAmount,
      startsAt: updated.startsAt,
      expiresAt: updated.expiresAt,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    }
  }

  /**
   * Отчёт по выплатам партнёрам за период
   */
  async generatePayoutReport(from: Date, to: Date): Promise<{
    rows: PartnerReportRow[]
    totals: {
      ordersCount: number
      paidOrdersCount: number
      revenue: number
      clientDiscount: number
      payout: number
    }
  }> {
    // Все погашения кодов за период по неотменённым заказам; выручка и
    // выплата дальше считаются только по оплаченным, но «сколько заказов
    // пришло по коду» должно включать и ещё не оплаченные.
    const redemptions = await db.promoCodeRedemption.findMany({
      where: {
        createdAt: {
          gte: from,
          lte: to,
        },
        order: {
          status: {
            not: 'cancelled',
          },
        },
      },
      include: {
        promoCode: {
          include: {
            partner: true,
          },
        },
        order: {
          select: {
            id: true,
            total: true,
            paymentStatus: true,
            status: true,
          },
        },
      },
    })

    // Сгруппировать по партнёрам
    const byPartner = new Map<
      string,
      {
        partner: { id: string; name: string; commissionPercent: number }
        orders: { id: string; total: number; paid: boolean }[]
        redemptions: { discountAmount: number }[]
      }
    >()

    for (const redemption of redemptions) {
      if (!redemption.promoCode.partner) continue

      const key = redemption.promoCode.partner.id
      if (!byPartner.has(key)) {
        byPartner.set(key, {
          partner: {
            id: redemption.promoCode.partner.id,
            name: redemption.promoCode.partner.name,
            commissionPercent: redemption.promoCode.partner.commissionPercent,
          },
          orders: [],
          redemptions: [],
        })
      }

      const data = byPartner.get(key)!
      const paid = redemption.order.paymentStatus === 'paid'
      data.orders.push({ id: redemption.order.id, total: redemption.order.total, paid })
      if (paid) data.redemptions.push({ discountAmount: redemption.discountAmount })
    }

    // Построить итоговые строки
    const rows: PartnerReportRow[] = []
    let totalOrdersCount = 0
    let totalPaidOrdersCount = 0
    let totalRevenue = 0
    let totalDiscount = 0
    let totalPayout = 0

    for (const [, data] of byPartner) {
      const ordersCount = new Set(data.orders.map((o) => o.id)).size
      const paidOrders = data.orders.filter((o) => o.paid)
      const paidOrdersCount = new Set(paidOrders.map((o) => o.id)).size
      const revenue = paidOrders.reduce((sum, o) => sum + o.total, 0)
      const discount = data.redemptions.reduce((sum, r) => sum + r.discountAmount, 0)
      const payout = Math.round((revenue * data.partner.commissionPercent) / 100)

      rows.push({
        partnerId: data.partner.id,
        partnerName: data.partner.name,
        commissionPercent: data.partner.commissionPercent,
        ordersCount,
        paidOrdersCount,
        revenue,
        clientDiscount: discount,
        payout,
      })

      totalOrdersCount += ordersCount
      totalPaidOrdersCount += paidOrdersCount
      totalRevenue += revenue
      totalDiscount += discount
      totalPayout += payout
    }

    return {
      rows: rows.sort((a, b) => b.revenue - a.revenue),
      totals: {
        ordersCount: totalOrdersCount,
        paidOrdersCount: totalPaidOrdersCount,
        revenue: totalRevenue,
        clientDiscount: totalDiscount,
        payout: totalPayout,
      },
    }
  }

  /**
   * Проверка валидности промокода (3-20 символов, буквы и цифры)
   */
  private isValidPromoCode(code: string): boolean {
    if (!code || code.length < 3 || code.length > 20) {
      return false
    }
    return /^[A-Za-z0-9]+$/.test(code)
  }
}

export const adminPromoService = new AdminPromoService()
