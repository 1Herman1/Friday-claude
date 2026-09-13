import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { getAllQuotes, createDeliveryOrder, listPickupPoints } from '../../services/delivery/delivery.service.js'
import { checkRateLimit } from '../../lib/rate-limit.js'
import { listDeliveryOptions } from '../../services/delivery/delivery-options.js'
import { pickupPointSchema } from '../../services/delivery/pickup-point.schema.js'

async function adminOnly(request: FastifyRequest, reply: FastifyReply) {
  await request.jwtVerify()
  const { role } = request.user
  if (role !== 'super_admin' && role !== 'orders_manager') {
    return reply.status(403).send({ error: 'Недостаточно прав' })
  }
}

const pickupPointsQuerySchema = z.object({
  provider: z.enum(['cdek', 'yandex', 'ozon']),
  city: z.string().trim().min(2).max(100),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
})

const createSchema = z.object({
  provider: z.enum(['simba_courier', 'cdek', 'yandex', 'pickup']),
  orderId: z.string().min(1),
  address: z.object({
    city: z.string().trim().min(1),
    street: z.string().optional(),
    house: z.string().optional(),
    apartment: z.string().optional(),
    postalCode: z.string().optional(),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    pickupPoint: pickupPointSchema.optional(),
  }),
  weightKg: z.number().positive().max(100),
  recipientName: z.string().trim().min(1),
  recipientPhone: z.string().trim().min(5),
})

const quotesSchema = z.object({
  city: z.string().min(2),
  street: z.string().optional(),
  house: z.string().optional(),
  postalCode: z.string().optional(),
  /// Координаты нужны Яндекс.Доставке: без них providers/yandex.ts подставляет
  /// центр Москвы и считает цену до него, то есть неверно для любого адреса.
  /// Схема их раньше отбрасывала, и тип DeliveryAddress.lat/lon стоял пустым.
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  weightKg: z.number().positive().max(100),
  subtotal: z.number().int().min(0).optional(),
  pickupPoint: pickupPointSchema.optional(),
})

export default async function deliveryRoutes(app: FastifyInstance) {
  // GET /api/delivery/options — прайс-лист: включённые способы с ценами.
  // Его читают и чекаут, и страница «Доставка», чтобы цифры не расходились.
  app.get('/options', async (_req, reply) => {
    const options = await listDeliveryOptions(app.prisma)
    reply.header('Cache-Control', 'public, max-age=60')
    return reply.send({ options })
  })


  // POST /api/delivery/quotes — расчёт стоимости всех провайдеров
  app.post('/quotes', async (req, reply) => {
    const clientIp = req.ip

    if (!checkRateLimit(clientIp, 'quotes')) {
      return reply.status(429).send({
        error: 'Слишком много запросов. Попробуйте позже',
        retryAfter: 300,
      })
    }

    const result = quotesSchema.safeParse(req.body)
    if (!result.success) {
      // Текст zod («Number must be greater than 0») показывать покупателю
      // нельзя: он английский и про внутренности схемы, а не про его адрес.
      return reply.status(400).send({ error: 'Не удалось рассчитать доставку по этому адресу' })
    }

    const { city, street, house, postalCode, lat, lon, weightKg, subtotal, pickupPoint } = result.data

    const quotes = await getAllQuotes(
      app.prisma,
      { city, street, house, postalCode, lat, lon, pickupPoint },
      { weightKg, subtotal }
    )

    return reply.send({ quotes })
  })

  // GET /api/delivery/pickup-points — список пунктов выдачи службы в городе
  app.get('/pickup-points', async (req, reply) => {
    if (!checkRateLimit(req.ip, 'pickup-points')) {
      return reply.status(429).send({
        error: 'Слишком много запросов. Попробуйте позже',
        retryAfter: 300,
      })
    }

    const parsed = pickupPointsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Укажите службу доставки и город' })
    }

    const { provider, city, lat, lon } = parsed.data
    const near = lat !== undefined && lon !== undefined ? { lat, lon } : undefined

    try {
      const points = await listPickupPoints(provider, city, near)
      return reply.send({ points })
    } catch (err) {
      // Отказ службы — не «в этом городе пунктов нет»: покупатель должен
      // увидеть «попробовать ещё раз», а не пустой список.
      app.log.error({ err, provider, city }, 'Не удалось получить пункты выдачи')
      return reply.status(502).send({ error: 'Не удалось получить список пунктов выдачи' })
    }
  })

  // POST /api/delivery/create — создать заявку у службы доставки.
  // Операция бэк-офиса: покупатель заявку не создаёт, её оформляет магазин.
  // Раньше хватало любого токена (включая гостевой), а заказ по orderId не
  // сверялся с владельцем — чужой заказ можно было отгрузить на свой адрес.
  app.post('/create', { preHandler: adminOnly }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Проверьте данные доставки' })
    }
    const { provider, orderId, address, weightKg, recipientName, recipientPhone } = parsed.data

    try {
      const result = await createDeliveryOrder(
        provider,
        address,
        { weightKg },
        orderId,
        recipientName,
        recipientPhone
      )
      return reply.send(result)
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Ошибка создания заказа доставки' })
    }
  })

  // GET /api/delivery/features — возможности системы доставки
  app.get('/features', async (req, reply) => {
    return reply.send({
      suggest: Boolean(process.env.DADATA_TOKEN),
      map: false,
    })
  })
}
