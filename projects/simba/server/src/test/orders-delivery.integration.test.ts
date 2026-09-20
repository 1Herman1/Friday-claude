import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createUser, createProductWithVariant, createCart, authHeader, seedDeliveryOptions } from './factories'

// Цены из seedDeliveryOptions (копейки)
const COURIER_PRICE = 70000
const PVZ_PRICE = 9900

const cdekPoint = {
  provider: 'cdek' as const,
  code: 'MSK-1',
  name: 'ПВЗ на Тверской',
  address: 'Москва, ул. Тверская, 1',
  lat: 55.7601,
  lon: 37.6156,
}

const moscowAddress = { city: 'Москва', street: 'ул. Ленина', house: '12' }

describe.skipIf(!hasTestDb)('Доставка в заказе: цена, город, пункт выдачи (интеграционные)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    const { buildApp } = await import('../index')
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    if (app) await app.close()
    await closeTestPrisma()
  })

  beforeEach(async () => {
    await resetDb()
    await seedDeliveryOptions()
  })

  async function checkout(payload: Record<string, unknown>) {
    const { variant } = await createProductWithVariant({ price: 100000, stock: 10, weight: 1 })
    const user = await createUser()
    const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 1 }])
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeader(app, user.id),
      payload: { cartId: cart.id, hasSpecialPackaging: false, ...payload },
    })
    // Успешный заказ запускает фоновый расчёт расхода доставки; ждём его,
    // иначе запись столкнётся с TRUNCATE следующего теста.
    if (res.statusCode === 201) await new Promise((r) => setTimeout(r, 200))
    return res
  }

  describe('цена доставки — только из таблицы delivery_options', () => {
    it('цену берёт база, а не клиент: изменённая админом цена ломает старый расчёт → 409', async () => {
      const prisma = getTestPrisma()
      await prisma.deliveryOption.update({
        where: { key: 'simba_courier' },
        data: { price: 99000 },
      })

      const res = await checkout({
        deliveryMethod: 'simba_courier',
        deliveryAddress: moscowAddress,
        deliveryCost: COURIER_PRICE,
      })

      expect(res.statusCode).toBe(409)
      expect(res.json().code).toBe('DELIVERY_COST_CHANGED')
      expect(res.json().actualDeliveryCost).toBe(99000)
      expect(await prisma.order.count()).toBe(0)
    })

    it('завышенная клиентом стоимость доставки тоже отклоняется → 409', async () => {
      const prisma = getTestPrisma()

      const res = await checkout({
        deliveryMethod: 'cdek',
        deliveryAddress: { city: 'Москва' },
        deliveryPoint: cdekPoint,
        deliveryCost: PVZ_PRICE + 50000,
      })

      expect(res.statusCode).toBe(409)
      expect(res.json().actualDeliveryCost).toBe(PVZ_PRICE)
      expect(await prisma.order.count()).toBe(0)
    })

    it('самовывоз бесплатен: любая ненулевая стоимость от клиента → 409', async () => {
      const prisma = getTestPrisma()

      const res = await checkout({ deliveryMethod: 'pickup', deliveryCost: 30000 })

      expect(res.statusCode).toBe(409)
      expect(res.json().code).toBe('DELIVERY_COST_CHANGED')
      expect(res.json().actualDeliveryCost).toBe(0)
      expect(await prisma.order.count()).toBe(0)
    })

    it('выключенный способ доставки не даёт оформить заказ', async () => {
      const prisma = getTestPrisma()
      await prisma.deliveryOption.update({
        where: { key: 'cdek_pvz' },
        data: { isActive: false },
      })

      const res = await checkout({
        deliveryMethod: 'cdek',
        deliveryAddress: { city: 'Москва' },
        deliveryPoint: cdekPoint,
        deliveryCost: PVZ_PRICE,
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/недоступен/i)
      expect(await prisma.order.count()).toBe(0)
    })

    it('доставка входит в total заказа, но не в subtotal', async () => {
      const prisma = getTestPrisma()

      const res = await checkout({
        deliveryMethod: 'simba_courier',
        deliveryAddress: moscowAddress,
        deliveryCost: COURIER_PRICE,
      })

      expect(res.statusCode).toBe(201)
      const row = await prisma.order.findFirstOrThrow()
      expect(row.subtotal).toBe(100000)
      expect(row.deliveryCost).toBe(COURIER_PRICE)
      expect(row.total).toBe(100000 + COURIER_PRICE - row.bonusUsed)
    })
  })

  describe('курьер Simba — только Москва', () => {
    it('Московская область курьером не доставляется, заказа нет', async () => {
      const prisma = getTestPrisma()

      const res = await checkout({
        deliveryMethod: 'simba_courier',
        deliveryAddress: { city: 'Московская область, Химки', street: 'ул. Мира', house: '3' },
        deliveryCost: COURIER_PRICE,
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/только по Москве/i)
      expect(await prisma.order.count()).toBe(0)
    })

    it('другой город курьером не доставляется', async () => {
      const res = await checkout({
        deliveryMethod: 'simba_courier',
        deliveryAddress: { city: 'Казань', street: 'ул. Баумана', house: '1' },
        deliveryCost: COURIER_PRICE,
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/только по Москве/i)
    })

    it('курьер без улицы и дома не принимается', async () => {
      const res = await checkout({
        deliveryMethod: 'simba_courier',
        deliveryAddress: { city: 'Москва' },
        deliveryCost: COURIER_PRICE,
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/улицу и дом/i)
    })

    it('addressType apartment без номера квартиры не принимается', async () => {
      const res = await checkout({
        deliveryMethod: 'simba_courier',
        deliveryAddress: {
          city: 'Москва',
          street: 'ул. Ленина',
          house: '12',
          addressType: 'apartment',
        },
        deliveryCost: COURIER_PRICE,
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/номер квартиры|выберите.*Частный дом/i)
    })

    it('addressType apartment с номером квартиры принимается', async () => {
      const prisma = getTestPrisma()

      const res = await checkout({
        deliveryMethod: 'simba_courier',
        deliveryAddress: {
          city: 'Москва',
          street: 'ул. Ленина',
          house: '12',
          apartment: '42',
          entrance: '1',
          floor: '3',
          intercom: '4201',
          addressType: 'apartment',
        },
        deliveryCost: COURIER_PRICE,
      })

      expect(res.statusCode).toBe(201)
      const order = await prisma.order.findFirstOrThrow()
      const addr = order.deliveryAddress as Record<string, unknown>
      expect(addr.apartment).toBe('42')
      expect(addr.entrance).toBe('1')
      expect(addr.floor).toBe('3')
      expect(addr.intercom).toBe('4201')
      expect(addr.addressType).toBe('apartment')
    })

    it('addressType house без apartment принимается', async () => {
      const prisma = getTestPrisma()

      const res = await checkout({
        deliveryMethod: 'simba_courier',
        deliveryAddress: {
          city: 'Москва',
          street: 'ул. Ленина',
          house: '12',
          addressType: 'house',
        },
        deliveryCost: COURIER_PRICE,
      })

      expect(res.statusCode).toBe(201)
      const order = await prisma.order.findFirstOrThrow()
      const addr = order.deliveryAddress as Record<string, unknown>
      expect(addr.addressType).toBe('house')
      expect(addr.apartment).toBeUndefined()
    })
  })

  describe('пункт выдачи должен быть своей службы', () => {
    it('пункт СДЭК с методом yandex отклоняется', async () => {
      const prisma = getTestPrisma()

      const res = await checkout({
        deliveryMethod: 'yandex',
        deliveryAddress: { city: 'Москва' },
        deliveryPoint: cdekPoint,
        deliveryCost: 0,
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/не относится к выбранной службе/i)
      expect(await prisma.order.count()).toBe(0)
    })

    it('yandex без пункта выдачи отклоняется', async () => {
      const res = await checkout({
        deliveryMethod: 'yandex',
        deliveryAddress: { city: 'Москва' },
        deliveryCost: 0,
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/пункт выдачи/i)
    })

    it('пункт чужой службы (ozon) с методом cdek отклоняется', async () => {
      const res = await checkout({
        deliveryMethod: 'cdek',
        deliveryAddress: { city: 'Москва' },
        deliveryPoint: { ...cdekPoint, provider: 'ozon' },
        deliveryCost: PVZ_PRICE,
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/не относится к выбранной службе/i)
    })
  })

  describe('GET /api/delivery/options', () => {
    it('отдаёт только включённые способы с ценами из базы', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/delivery/options' })

      expect(res.statusCode).toBe(200)
      const { options } = res.json() as { options: { key: string; price: number }[] }
      const keys = options.map((o) => o.key)

      expect(keys).toContain('simba_courier')
      expect(keys).toContain('cdek_pvz')
      // ozon_pvz выключен в seedDeliveryOptions
      expect(keys).not.toContain('ozon_pvz')
      expect(options.find((o) => o.key === 'simba_courier')?.price).toBe(COURIER_PRICE)
    })

    it('выключенный админом способ пропадает из выдачи', async () => {
      const prisma = getTestPrisma()
      await prisma.deliveryOption.update({ where: { key: 'cdek_pvz' }, data: { isActive: false } })

      const res = await app.inject({ method: 'GET', url: '/api/delivery/options' })
      const { options } = res.json() as { options: { key: string }[] }

      expect(options.map((o) => o.key)).not.toContain('cdek_pvz')
    })

    it('не требует авторизации и не отдаёт расход магазина', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/delivery/options' })
      const { options } = res.json() as { options: Record<string, unknown>[] }

      expect(res.statusCode).toBe(200)
      for (const option of options) {
        expect(option).not.toHaveProperty('expense')
      }
    })
  })
})
