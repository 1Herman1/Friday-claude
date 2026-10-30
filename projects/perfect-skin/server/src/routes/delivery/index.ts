import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fastifyPlugin from 'fastify-plugin'
import { z } from 'zod'
import { cartService } from '../../services/cart.service.js'
import { promoService } from '../../services/promo.service.js'
import { ApiError } from '../../lib/errors.js'
import { resolvePrice } from '../../lib/pricing.js'
import { getCdek } from '../../services/cdek/registry.js'
import { deliveryQuote, type MethodQuote } from '../../services/cdek/quote.service.js'
import * as psSharedNs from '@ps/shared'
import deliveryCdekRoutes from './cdek.js'
const shared = (psSharedNs as unknown as { default?: typeof psSharedNs }).default ?? psSharedNs
const { calcDeliveryCost, FREE_PVZ_THRESHOLD, FREE_COURIER_THRESHOLD } = shared

const DELIVERY_TITLES = {
  pickup: 'Самовывоз',
  cdek_pvz: 'СДЭК — пункт выдачи или постамат',
  cdek_courier: 'СДЭК — курьер',
}

const DELIVERY_HINTS = {
  pickup: 'Москва, Звенигородское шоссе, 3Ас1',
  cdek_pvz: `Бесплатно от ${(FREE_PVZ_THRESHOLD / 100).toLocaleString('ru-RU')} ₽`,
  cdek_courier: `Бесплатно от ${(FREE_COURIER_THRESHOLD / 100).toLocaleString('ru-RU')} ₽`,
}

const NO_STORE = 'no-store'

export default fastifyPlugin(async (app: FastifyInstance) => {
  await app.register(deliveryCdekRoutes)

  app.get<{ Querystring: { promo?: string; cityCode?: number }; Reply: any }>(
    '/api/v1/delivery/methods',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
          keyGenerator: (req: any) => req.user?.id ?? req.cookies?.ps_sid ?? req.ip,
        },
      },
      schema: {
        querystring: {
          type: 'object',
          properties: {
            promo: { type: 'string', minLength: 3, maxLength: 32 },
            cityCode: { type: 'integer', minimum: 1, maximum: 9999999 },
          },
        },
        response: {
          200: { $ref: 'ps.deliveryMethods#' },
          409: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticateOptional,
    },
    async (request: FastifyRequest<{ Querystring: { promo?: string; cityCode?: number } }>, reply: FastifyReply) => {
      const owner = cartService.resolveCartOwner(request)
      if (!owner) {
        throw new ApiError(409, 'CART_EMPTY', 'Корзина пуста')
      }

      const cart = await cartService.getOrCreateCart(owner)
      if (!cart || cart.items.length === 0) {
        throw new ApiError(409, 'CART_EMPTY', 'Корзина пуста')
      }

      // Calculate subtotal using resolved prices
      const viewer = request.user ? { role: request.user.role, proStatus: request.user.proStatus } : null
      const subtotal = cart.items.reduce((sum: number, item: any) => {
        const resolvedPrice = resolvePrice({ retailPrice: item.productVariant.retailPrice, wholesalePrice: item.productVariant.wholesalePrice }, viewer)
        return sum + resolvedPrice * item.quantity
      }, 0)

      // Validate promo if provided
      let promoData = null
      if ((request.query as any)?.promo) {
        try {
          const promoSchema = z.object({
            promo: z
              .string()
              .trim()
              .min(3)
              .max(32)
              .regex(/^[A-Za-z0-9_-]+$/),
          })

          const parsed = promoSchema.safeParse({ promo: (request.query as any)?.promo })
          if (parsed.success) {
            promoData = await promoService.validateCode(parsed.data.promo, subtotal)
          }
        } catch {
          // Silently ignore invalid promo
        }
      }

      // Calculate goods after discount
      const goodsAfterDiscount = promoData
        ? Math.max(0, subtotal - promoData.discount)
        : subtotal

      const cdekEnabled = getCdek() !== null
      const cityCode = request.query.cityCode ?? null
      const quotes: MethodQuote[] | null = cdekEnabled
        ? await deliveryQuote(app.log).methods({
            cityCode,
            items: cart.items.map((item: any) => ({
              weightGrams: item.productVariant.weightGrams ?? null,
              quantity: item.quantity,
            })),
            goodsAfterDiscount,
          })
        : null
      const quoteOf = (code: MethodQuote['code']): MethodQuote | undefined => quotes?.find((q) => q.code === code)

      const pvzQuote = quoteOf('cdek_pvz')
      const courierQuote = quoteOf('cdek_courier')

      // Build delivery methods
      const methods = [
        {
          code: 'pickup',
          title: DELIVERY_TITLES.pickup,
          hint: DELIVERY_HINTS.pickup,
          cost: 0,
          isFree: true,
          freeFrom: null,
          amountToFree: 0,
          requiresAddress: false,
          requiresPvzCode: false,
          requiresCity: false,
          available: true,
          quoteSource: 'fixed',
          periodMin: null,
          periodMax: null,
          costByPointType: null,
        },
        {
          code: 'cdek_pvz',
          title: DELIVERY_TITLES.cdek_pvz,
          hint: DELIVERY_HINTS.cdek_pvz,
          cost: pvzQuote ? pvzQuote.cost : (calcDeliveryCost('pvz', goodsAfterDiscount) as number),
          isFree: goodsAfterDiscount >= FREE_PVZ_THRESHOLD,
          freeFrom: FREE_PVZ_THRESHOLD,
          amountToFree: Math.max(0, FREE_PVZ_THRESHOLD - goodsAfterDiscount),
          requiresAddress: false,
          requiresPvzCode: true,
          requiresCity: cdekEnabled,
          available: pvzQuote ? pvzQuote.quoteSource !== 'unavailable' : true,
          quoteSource: pvzQuote?.quoteSource ?? 'fixed',
          periodMin: pvzQuote?.periodMin ?? null,
          periodMax: pvzQuote?.periodMax ?? null,
          costByPointType: pvzQuote?.costByPointType ?? null,
        },
        {
          code: 'cdek_courier',
          title: DELIVERY_TITLES.cdek_courier,
          hint: DELIVERY_HINTS.cdek_courier,
          cost: courierQuote ? courierQuote.cost : (calcDeliveryCost('courier', goodsAfterDiscount) as number),
          isFree: goodsAfterDiscount >= FREE_COURIER_THRESHOLD,
          freeFrom: FREE_COURIER_THRESHOLD,
          amountToFree: Math.max(0, FREE_COURIER_THRESHOLD - goodsAfterDiscount),
          requiresAddress: true,
          requiresPvzCode: false,
          requiresCity: cdekEnabled,
          available: courierQuote ? courierQuote.quoteSource !== 'unavailable' : true,
          quoteSource: courierQuote?.quoteSource ?? 'fixed',
          periodMin: courierQuote?.periodMin ?? null,
          periodMax: courierQuote?.periodMax ?? null,
          costByPointType: null,
        },
      ]

      reply.header('Cache-Control', NO_STORE)
      reply.status(200).send({
        subtotal,
        promo: promoData,
        goodsAfterDiscount,
        cdekEnabled,
        methods,
      })
    }
  )
})
