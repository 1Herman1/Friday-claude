import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { CONSENT_VERSION, REVIEW_PUBLICATION_CONSENT_VERSION } from '@simba/shared'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createUser, createProductWithVariant, createGuestSession, seedDeliveryOptions, authHeader } from './factories'
import { otpService } from '../services/otp.service'

describe.skipIf(!hasTestDb)('Согласие на обработку ПД (интеграционные)', () => {
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

  let ipCounter = 0
  const nextIp = () => {
    ipCounter += 1
    return `10.10.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`
  }

  describe('verify-otp: согласие обязательно', () => {
    it('без consentVersion → 400', async () => {
      const prisma = getTestPrisma()
      const email = 'test@example.test'
      const user = await prisma.user.create({
        data: { email, name: 'Test' },
      })

      const code = await otpService.createOtp(prisma, user.id, 'email')
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-otp',
        payload: { email, code },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toContain('согласие')
    })

    it('с consentVersion → 200 + запись в consents', async () => {
      const prisma = getTestPrisma()
      const email = 'test@example.test'
      const user = await prisma.user.create({
        data: { email, name: 'Test' },
      })

      const code = await otpService.createOtp(prisma, user.id, 'email')
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-otp',
        remoteAddress: '127.0.0.1',
        payload: { email, code, consentVersion: CONSENT_VERSION },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().token).toBeTruthy()

      // Проверить запись в consents
      const consent = await prisma.consent.findFirst({
        where: { userId: user.id, kind: 'pd_processing' },
      })
      expect(consent).toBeTruthy()
      expect(consent?.textVersion).toBe(CONSENT_VERSION)
      expect(consent?.ip).toBe('127.0.0.1')
      expect(consent?.userAgent).toBeDefined()
    })
  })

  describe('me: hasPdConsent', () => {
    it('гость → false', async () => {
      const guest = await createGuestSession(app)
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: guest.headers,
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().hasPdConsent).toBe(false)
    })

    it('покупатель с согласием → true', async () => {
      const user = await createUser({ withConsent: true })
      const headers = authHeader(app, user.id)

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers,
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().hasPdConsent).toBe(true)
    })

    it('покупатель без согласия → false', async () => {
      const user = await createUser({ withConsent: false })
      const headers = authHeader(app, user.id)

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers,
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().hasPdConsent).toBe(false)
    })
  })

  describe('заказы: согласие требуется для гостей и без ПД', () => {
    const pickupOrder = (cartId: string, extra: Record<string, unknown> = {}) => ({
      cartId,
      deliveryMethod: 'pickup',
      hasSpecialPackaging: false,
      deliveryCost: 0,
      ...extra,
    })

    it('гостевой заказ без consentVersion → 400 CONSENT_REQUIRED', async () => {
      const prisma = getTestPrisma()
      const ip = nextIp()
      const { variant } = await createProductWithVariant()
      const guest = await createGuestSession(app, ip)

      // Добавить товар в корзину
      const cartRes = await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: guest.headers,
        remoteAddress: ip,
        payload: { productVariantId: variant.id, quantity: 1 },
      })
      const cartId = cartRes.json().id as string

      // Заказ без согласия
      const orderRes = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: guest.headers,
        remoteAddress: ip,
        payload: {
          ...pickupOrder(cartId),
          contact: { name: 'Иван', email: 'ivan@example.test', phone: '+79990000001' },
        },
      })

      expect(orderRes.statusCode).toBe(400)
      expect(orderRes.json().code).toBe('CONSENT_REQUIRED')
    })

    it('гостевой заказ с consentVersion → 201 + запись с userId === null', async () => {
      const prisma = getTestPrisma()
      const ip = nextIp()
      const { variant } = await createProductWithVariant()
      const guest = await createGuestSession(app, ip)

      // Добавить товар в корзину
      const cartRes = await app.inject({
        method: 'POST',
        url: '/api/cart/items',
        headers: guest.headers,
        remoteAddress: ip,
        payload: { productVariantId: variant.id, quantity: 1 },
      })
      const cartId = cartRes.json().id as string

      // Заказ с согласием
      const orderRes = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: guest.headers,
        remoteAddress: ip,
        payload: {
          ...pickupOrder(cartId),
          consentVersion: CONSENT_VERSION,
          contact: { name: 'Иван', email: 'ivan@example.test', phone: '+79990000001' },
        },
      })

      expect(orderRes.statusCode).toBe(201)
      const order = orderRes.json()

      // Проверить запись согласия: у гостевого заказа userId === null, orderId заполнен
      const consent = await prisma.consent.findFirst({
        where: { orderId: order.id, kind: 'pd_processing' },
      })
      expect(consent).toBeTruthy()
      expect(consent?.userId).toBeNull()
      expect(consent?.orderId).toBe(order.id)
      expect(consent?.textVersion).toBe(CONSENT_VERSION)
      expect(consent?.ip).toBe(ip)
    })

    it('покупатель с согласием без consentVersion → 201 без новой записи', async () => {
      const prisma = getTestPrisma()
      const ip = nextIp()
      const user = await createUser({ withConsent: true })
      const { variant } = await createProductWithVariant()

      // Создать корзину
      const cart = await prisma.cart.create({ data: { userId: user.id } })
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productVariantId: variant.id,
          productId: variant.productId,
          quantity: 1,
        },
      })

      const headers = authHeader(app, user.id)
      const orderRes = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers,
        remoteAddress: ip,
        payload: pickupOrder(cart.id),
      })

      expect(orderRes.statusCode).toBe(201)

      // Не должно быть новой записи согласия
      const newConsents = await prisma.consent.findMany({
        where: { userId: user.id, kind: 'pd_processing', orderId: { not: null } },
      })
      expect(newConsents).toHaveLength(0)
    })

    it('покупатель без согласия без consentVersion → 400 CONSENT_REQUIRED', async () => {
      const prisma = getTestPrisma()
      const ip = nextIp()
      const user = await createUser({ withConsent: false })
      const { variant } = await createProductWithVariant()

      // Создать корзину
      const cart = await prisma.cart.create({ data: { userId: user.id } })
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productVariantId: variant.id,
          productId: variant.productId,
          quantity: 1,
        },
      })

      const headers = authHeader(app, user.id)
      const orderRes = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers,
        remoteAddress: ip,
        payload: pickupOrder(cart.id),
      })

      expect(orderRes.statusCode).toBe(400)
      expect(orderRes.json().code).toBe('CONSENT_REQUIRED')
    })
  })

  describe('отзывы: согласие на публикацию обязательно', () => {
    it('без publishConsentVersion → 400', async () => {
      const user = await createUser()
      const headers = authHeader(app, user.id)

      const res = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        headers,
        payload: { rating: 5, text: 'Отличный корм для кота!' },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toContain('согласие')
      expect(res.json().error).toContain('публикацию')
    })

    it('с publishConsentVersion → 201 + запись', async () => {
      const prisma = getTestPrisma()
      const user = await createUser()
      const headers = authHeader(app, user.id)

      const res = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        headers,
        remoteAddress: '127.0.0.1',
        payload: {
          rating: 5,
          text: 'Отличный корм для кота!',
          publishConsentVersion: REVIEW_PUBLICATION_CONSENT_VERSION,
        },
      })

      expect(res.statusCode).toBe(201)
      const review = res.json()

      // Проверить запись согласия
      const consent = await prisma.consent.findFirst({
        where: { reviewId: review.id, kind: 'review_publication' },
      })
      expect(consent).toBeTruthy()
      expect(consent?.textVersion).toBe(REVIEW_PUBLICATION_CONSENT_VERSION)
      expect(consent?.ip).toBe('127.0.0.1')
    })
  })
})
