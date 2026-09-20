import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fastifyPlugin from 'fastify-plugin'
import { z } from 'zod'
import { cartService } from '../../services/cart.service.js'
import { promoService } from '../../services/promo.service.js'
import { ApiError } from '../../lib/errors.js'
import * as psSharedNs from '@ps/shared'
const { calcDeliveryCost, FREE_PVZ_THRESHOLD, FREE_COURIER_THRESHOLD, DELIVERY_COST } = ((psSharedNs as any).default ?? psSharedNs) as any

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

export default fastifyPlugin(async (app: FastifyInstance) => {
  app.get<{ Querystring: { promo?: string }; Reply: any }>(
    '/api/v1/delivery/methods',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            promo: { type: 'string', minLength: 3, maxLength: 32 },
          },
        },
        response: {
          200: { $ref: 'ps.deliveryMethods#' },
          409: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticateOptional,
    },
    async (request: FastifyRequest<{ Querystring: { promo?: string } }>, reply: FastifyReply) => {
      const owner = cartService.resolveCartOwner(request)
      if (!owner) {
        throw new ApiError(409, 'CART_EMPTY', 'Корзина пуста')
      }

      const cart = await cartService.getOrCreateCart(owner)
      if (!cart || cart.items.length === 0) {
        throw new ApiError(409, 'CART_EMPTY', 'Корзина пуста')
      }

      // Calculate subtotal
      const subtotal = cart.items.reduce((sum: number, item: any) => {
        return sum + item.productVariant.retailPrice * item.quantity
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
        },
        {
          code: 'cdek_pvz',
          title: DELIVERY_TITLES.cdek_pvz,
          hint: DELIVERY_HINTS.cdek_pvz,
          cost: calcDeliveryCost('pvz', goodsAfterDiscount) as number,
          isFree: goodsAfterDiscount >= FREE_PVZ_THRESHOLD,
          freeFrom: FREE_PVZ_THRESHOLD,
          amountToFree: Math.max(0, FREE_PVZ_THRESHOLD - goodsAfterDiscount),
          requiresAddress: false,
          requiresPvzCode: true,
        },
        {
          code: 'cdek_courier',
          title: DELIVERY_TITLES.cdek_courier,
          hint: DELIVERY_HINTS.cdek_courier,
          cost: calcDeliveryCost('courier', goodsAfterDiscount) as number,
          isFree: goodsAfterDiscount >= FREE_COURIER_THRESHOLD,
          freeFrom: FREE_COURIER_THRESHOLD,
          amountToFree: Math.max(0, FREE_COURIER_THRESHOLD - goodsAfterDiscount),
          requiresAddress: true,
          requiresPvzCode: false,
        },
      ]

      reply.status(200).send({
        subtotal,
        promo: promoData,
        goodsAfterDiscount,
        methods,
      })
    }
  )
})
