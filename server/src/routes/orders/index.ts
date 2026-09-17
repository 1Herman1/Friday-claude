import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { calcOrderTotals, type PickupPoint } from '@simba/shared'
import {
  createOrder,
  DuplicateOrderError,
  getOrdersByUser,
  getOrderById,
  DeliveryCostMismatchError,
  InsufficientBonusError,
} from '../../services/order.service'
import { PromoCodeError } from '../../services/promo.service'
import { findOrCreateCustomerByEmail } from '../../services/customer.service'
import { pickupPointSchema } from '../../services/delivery/pickup-point.schema'
import { consentVersionSchema, consentSource, recordConsent, hasPdConsent, PD_CONSENT_VERSIONS } from '../../services/consent.service'

// Сообщения — по-русски: первое из них уходит покупателю как есть, а «Required»
// от zod ему ничего не говорит.
const deliveryAddressSchema = z.object({
  city: z.string({ required_error: 'Укажите город' }).trim().min(1, 'Укажите город'),
  street: z.string().trim().optional(),
  house: z.string().trim().optional(),
  apartment: z.string().optional(),
  entrance: z.string().max(20).optional(),
  floor: z.string().max(10).optional(),
  intercom: z.string().max(30).optional(),
  addressType: z.enum(['apartment', 'house']).optional(),
  postalCode: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
})

const contactSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
})

const createOrderSchema = z
  .object({
    cartId: z.string().uuid(),
    deliveryMethod: z.enum(['simba_courier', 'cdek', 'yandex', 'ozon', 'pickup']),
    deliveryAddress: deliveryAddressSchema.optional(),
    deliveryPoint: pickupPointSchema.optional(),
    comment: z.string().optional(),
    hasSpecialPackaging: z.boolean().default(false),
    bonusUsed: z.number().int().min(0).default(0),
    promoCode: z.string().trim().max(40).optional(),
    deliveryCost: z.number().int().min(0).default(0),
    paymentMethod: z.enum(['card', 'cash_on_delivery']).default('card'),
    contact: contactSchema.optional(),
    consentVersion: consentVersionSchema('Нужно согласие на обработку персональных данных', PD_CONSENT_VERSIONS).optional(),
  })
  .superRefine((data, ctx) => {
    // Самовывоз: адрес и пункт не нужны
    if (data.deliveryMethod === 'pickup') {
      return
    }

    // Другие методы: город обязателен
    if (!data.deliveryAddress?.city?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Укажите город',
        path: ['deliveryAddress', 'city'],
      })
      return
    }

    // СДЭК и Яндекс — только в пункт выдачи
    if (data.deliveryMethod === 'cdek' || data.deliveryMethod === 'yandex') {
      if (!data.deliveryPoint) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Выберите пункт выдачи',
          path: ['deliveryPoint'],
        })
        return
      }
      if (data.deliveryPoint.provider !== data.deliveryMethod) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Пункт выдачи не относится к выбранной службе',
          path: ['deliveryPoint'],
        })
      }
    }

    // simba_courier — требует адрес с улицей и домом
    if (data.deliveryMethod === 'simba_courier') {
      if (!data.deliveryAddress?.street?.trim() || !data.deliveryAddress?.house?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Для доставки курьером укажите улицу и дом',
          path: ['deliveryAddress'],
        })
      }
      // Если выбран тип квартира, обязательно укажите номер квартиры
      if (data.deliveryAddress?.addressType === 'apartment') {
        if (!data.deliveryAddress?.apartment?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Укажите номер квартиры или выберите «Частный дом»',
            path: ['deliveryAddress', 'apartment'],
          })
        }
      }
    }

    // Наличные: только simba_courier
    if (data.paymentMethod === 'cash_on_delivery') {
      if (data.deliveryMethod !== 'simba_courier') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Наличными можно оплатить только курьеру Simba',
          path: ['paymentMethod'],
        })
      }
    }
  })

// Rate limit для гостевых заказов по IP: 5 в час
const guestOrderAttempts = new Map<string, { attempts: number; resetAt: Date }>()
const GUEST_ORDER_RATE_LIMIT = 5
const GUEST_ORDER_WINDOW_MS = 60 * 60 * 1000 // 1 час

const orderRoutes: FastifyPluginAsync = async (app) => {
  app.post('/', { preHandler: app.authenticate }, async (request, reply) => {
    const result = createOrderSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message })
    }

    const { userId } = request.user
    const isGuest = request.user.type === 'guest'

    const cart = await app.prisma.cart.findUnique({
      where: { id: result.data.cartId },
      select: { userId: true },
    })

    if (!cart) {
      return reply.status(404).send({ error: 'Корзина не найдена' })
    }

    if (cart.userId !== userId) {
      return reply.status(403).send({ error: 'Доступ запрещён' })
    }

    // Гостевой заказ: обязателен contact с email
    if (isGuest) {
      if (!result.data.contact?.email) {
        return reply.status(400).send({ error: 'Email обязателен для оформления' })
      }

      // При доставке (не pickup) телефон обязателен
      if (result.data.deliveryMethod !== 'pickup' && !result.data.contact.phone) {
        return reply.status(400).send({ error: 'Телефон обязателен для доставки' })
      }

      // Гость не может списывать бонусы
      if (result.data.bonusUsed > 0) {
        return reply.status(400).send({ error: 'Списание бонусов доступно после входа' })
      }

      // Rate limit гостевых заказов по IP
      const clientIp = request.ip
      const now = new Date()
      let record = guestOrderAttempts.get(clientIp)

      if (record) {
        if (now.getTime() < record.resetAt.getTime()) {
          if (record.attempts >= GUEST_ORDER_RATE_LIMIT) {
            return reply
              .status(429)
              .send({ error: 'Слишком много заказов. Попробуйте через час.' })
          }
        } else {
          guestOrderAttempts.delete(clientIp)
          record = undefined
        }
      }
    }

    // Проверка согласия на обработку ПД
    const needsConsent = isGuest || !(await hasPdConsent(app.prisma, userId))
    if (needsConsent && !result.data.consentVersion) {
      return reply.status(400).send({
        error: 'Нужно согласие на обработку персональных данных',
        code: 'CONSENT_REQUIRED',
      })
    }

    const { consentVersion, ...orderInput } = result.data
    const { bonusUsed } = orderInput
    if (bonusUsed < 0) {
      return reply.status(400).send({ error: 'Недостаточно бонусов' })
    }

    if (bonusUsed > 0) {
      const user = await app.prisma.user.findUnique({
        where: { id: userId },
        select: { bonusPoints: true },
      })
      if (!user || bonusUsed > user.bonusPoints) {
        return reply.status(400).send({ error: 'Недостаточно бонусов' })
      }
    }

    try {
      let customerUserId = userId

      // Гостевой заказ: найти или создать пользователя по email
      if (isGuest && orderInput.contact?.email) {
        customerUserId = await findOrCreateCustomerByEmail(
          app.prisma,
          orderInput.contact.email,
          orderInput.contact.name
        )
      }

      const order = await createOrder(
        app.prisma,
        { cartOwnerId: userId, customerUserId },
        {
          ...orderInput,
          expectedDeliveryCost: orderInput.deliveryCost,
          paymentMethod: orderInput.paymentMethod,
          guestCheckout: isGuest,
        }
      )

      // Инкрементить счётчик гостевых заказов ПОСЛЕ успешного создания
      if (isGuest) {
        const clientIp = request.ip
        const now = new Date()
        const currentRecord = guestOrderAttempts.get(clientIp)
        guestOrderAttempts.set(clientIp, {
          attempts: (currentRecord?.attempts ?? 0) + 1,
          resetAt: currentRecord?.resetAt || new Date(now.getTime() + GUEST_ORDER_WINDOW_MS),
        })
      }

      // Записать согласие если было передано
      if (consentVersion) {
        try {
          const source = consentSource(request)
          await recordConsent(app.prisma, {
            // Гость не владелец аккаунта, найденного по email: связь только через orderId
            userId: isGuest ? null : customerUserId,
            kind: 'pd_processing',
            textVersion: consentVersion,
            orderId: order.id,
            ip: source.ip,
            userAgent: source.userAgent,
          })
        } catch (err) {
          request.log.error(err, 'Ошибка записи согласия на заказ')
        }
      }

      return reply.status(201).send(order)
    } catch (err) {
      if (err instanceof DuplicateOrderError) {
        return reply.status(409).send({ error: err.message, code: 'DUPLICATE_ORDER' })
      }
      if (err instanceof PromoCodeError) {
        return reply.status(400).send({ error: err.reason, code: 'PROMO_INVALID' })
      }
      if (err instanceof DeliveryCostMismatchError) {
        return reply.status(409).send({
          error: 'Стоимость доставки изменилась, обновите расчёт',
          code: 'DELIVERY_COST_CHANGED',
          actualDeliveryCost: err.actualCost,
        })
      }
      if (err instanceof InsufficientBonusError) {
        return reply.status(409).send({
          error: err.message,
          code: 'INSUFFICIENT_BONUS',
        })
      }
      const message = err instanceof Error ? err.message : 'Ошибка создания заказа'
      return reply.status(400).send({ error: message })
    }
  })

  app.get('/', { preHandler: app.authenticate }, async (request, reply) => {
    const { userId } = request.user
    const orders = await getOrdersByUser(app.prisma, userId)
    return reply.send(orders)
  })

  app.get('/:id', { preHandler: app.authenticate }, async (request, reply) => {
    const { userId } = request.user
    const { id } = request.params as { id: string }

    try {
      const order = await getOrderById(app.prisma, id, userId)
      return reply.send(order)
    } catch {
      return reply.status(404).send({ error: 'Заказ не найден' })
    }
  })
}

export default orderRoutes
