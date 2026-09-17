import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createUser, authHeader, createProductWithVariant, createCart, seedDeliveryOptions } from './factories'
import { otpService } from '../services/otp.service'

describe.skipIf(!hasTestDb)('Удаление аккаунта и экспорт данных', () => {
  let app: FastifyInstance
  const prisma = getTestPrisma()

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

  it('DELETE /me удаляет все ПД и оставляет заказы/бонусы', async () => {
    // Создать полный профиль пользователя
    const user = await createUser({ name: 'Иван Петров' })
    const headers = authHeader(app, user.id)

    // Адрес
    await prisma.address.create({
      data: {
        userId: user.id,
        label: 'Дом',
        city: 'Москва',
        street: 'Ленина',
        house: '123',
        postalCode: '123456',
      },
    })

    // Питомец
    await prisma.pet.create({
      data: {
        userId: user.id,
        name: 'Барсик',
        species: 'cat',
        breed: 'Британец',
      },
    })

    // Товар и корзина
    const { product, variant } = await createProductWithVariant({ name: 'Корм Барсику' })
    const cart = await createCart(user.id, [{ variantId: variant.id, quantity: 2 }])

    // Избранное
    await prisma.favorite.create({
      data: { userId: user.id, productId: product.id },
    })

    // Сравнение
    const comparison = await prisma.comparison.create({
      data: { userId: user.id },
    })
    await prisma.comparisonProduct.create({
      data: { comparisonId: comparison.id, productId: product.id },
    })

    // Квиз
    await prisma.quizSession.create({
      data: {
        userId: user.id,
        species: 'cat',
        answers: { q1: 'a' },
        tags: ['dry', 'premium'],
        resultProductIds: [product.id],
      },
    })

    // Подписка
    await prisma.subscription.create({
      data: {
        userId: user.id,
        productVariantId: variant.id,
        productId: product.id,
        intervalDays: 28,
        nextDeliveryAt: new Date(Date.now() + 7 * 86400000),
      },
    })

    // Chat messages
    await prisma.chatMessage.create({
      data: {
        userId: user.id,
        sessionId: 'test-session-123',
        role: 'user',
        content: 'Какой корм выбрать?',
      },
    })

    // Заказ с контактными данными (сначала создать согласие)
    await prisma.consent.create({
      data: {
        userId: user.id,
        kind: 'pd_processing',
        textVersion: 'test',
      },
    })

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        status: 'confirmed',
        deliveryMethod: 'simba_courier',
        contactName: 'Иван Петров',
        contactEmail: 'ivan@example.com',
        contactPhone: '+71234567890',
        comment: 'Позвоните перед доставкой',
        deliveryAddress: { city: 'Москва', street: 'Ленина', house: '123' },
        subtotal: 50000,
        total: 50000,
        items: {
          create: {
            productVariantId: variant.id,
            productId: product.id,
            productName: product.name,
            variantWeight: variant.weight,
            price: variant.price,
            quantity: 1,
          },
        },
      },
    })

    // Бонус транзакции
    await prisma.bonusTransaction.create({
      data: {
        userId: user.id,
        type: 'welcome',
        amount: 300,
        balanceAfter: 300,
      },
    })

    // Отзывы: approved и pending
    const reviewApproved = await prisma.review.create({
      data: {
        authorName: 'Иван',
        rating: 5,
        text: 'Отличный корм!',
        status: 'approved',
        userId: user.id,
      },
    })

    const reviewPending = await prisma.review.create({
      data: {
        authorName: 'Иван',
        rating: 4,
        text: 'Хороший, но дороговато',
        status: 'pending',
        userId: user.id,
      },
    })

    // Запросить удаление аккаунта и получить код
    const requestRes = await app.inject({
      method: 'POST',
      url: '/api/auth/me/delete-request',
      headers,
    })
    expect(requestRes.statusCode).toBe(200)

    const code = await otpService.createOtp(prisma, user.id, 'email')

    // Удалить аккаунт с кодом
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: '/api/auth/me',
      headers,
      payload: { code },
    })

    expect(deleteRes.statusCode).toBe(200)
    expect(deleteRes.json()).toEqual({ ok: true })

    // Проверить что аккаунт удален
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updatedUser?.deletedAt).toBeTruthy()
    expect(updatedUser?.isActive).toBe(false)
    expect(updatedUser?.name).toBe('Удалённый пользователь')
    expect(updatedUser?.email).toBeNull()
    expect(updatedUser?.phone).toBeNull()
    expect(updatedUser?.passwordHash).toBeNull()
    expect(updatedUser?.lastSeenAt).toBeNull()

    // Проверить что все ПД удалено/очищено
    const addresses = await prisma.address.count({ where: { userId: user.id } })
    expect(addresses).toBe(0)

    const pets = await prisma.pet.count({ where: { userId: user.id } })
    expect(pets).toBe(0)

    const cartItems = await prisma.cartItem.count({ where: { cartId: cart.id } })
    expect(cartItems).toBe(0)

    const favorites = await prisma.favorite.count({ where: { userId: user.id } })
    expect(favorites).toBe(0)

    const comparisons = await prisma.comparison.count({ where: { userId: user.id } })
    expect(comparisons).toBe(0)

    const quizSessions = await prisma.quizSession.count({ where: { userId: user.id } })
    expect(quizSessions).toBe(0)

    const subscriptions = await prisma.subscription.count({ where: { userId: user.id } })
    expect(subscriptions).toBe(0)

    const chatMessages = await prisma.chatMessage.count({ where: { userId: user.id } })
    expect(chatMessages).toBe(0)

    // Заказ остается, но без контактных данных
    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } })
    expect(updatedOrder?.contactName).toBeNull()
    expect(updatedOrder?.contactEmail).toBeNull()
    expect(updatedOrder?.contactPhone).toBeNull()
    expect(updatedOrder?.comment).toBeNull()
    expect(updatedOrder?.deliveryAddress).toBeNull()
    expect(updatedOrder?.deliveryPoint).toBeNull()

    // Отзывы: pending удален, approved анонимизирован
    const checkPending = await prisma.review.findUnique({ where: { id: reviewPending.id } })
    expect(checkPending).toBeNull()

    const checkApproved = await prisma.review.findUnique({ where: { id: reviewApproved.id } })
    expect(checkApproved?.authorName).toBe('Аноним')
    expect(checkApproved?.userId).toBe(user.id) // userId остается для связи

    // Бонусы остаются
    const bonuses = await prisma.bonusTransaction.count({ where: { userId: user.id } })
    expect(bonuses).toBe(1)

    // Согласие на отзыв фиксируется
    const consentWithdrawal = await prisma.consent.findFirst({
      where: { userId: user.id, kind: 'withdrawal' },
    })
    expect(consentWithdrawal).toBeTruthy()
  })

  it('повторный DELETE /me тем же токеном → 401', async () => {
    const user = await createUser()
    const headers = authHeader(app, user.id)

    // Запросить удаление
    const requestRes = await app.inject({
      method: 'POST',
      url: '/api/auth/me/delete-request',
      headers,
    })
    expect(requestRes.statusCode).toBe(200)

    // Первый DELETE с кодом
    const code = await otpService.createOtp(prisma, user.id, 'email')
    const res1 = await app.inject({
      method: 'DELETE',
      url: '/api/auth/me',
      headers,
      payload: { code },
    })
    expect(res1.statusCode).toBe(200)

    // Повторный DELETE тем же токеном → 401 (isActive=false)
    const res2 = await app.inject({
      method: 'DELETE',
      url: '/api/auth/me',
      headers,
      payload: { code },
    })
    expect(res2.statusCode).toBe(401)
  })

  it('гость DELETE /me → 403', async () => {
    const guestToken = app.jwt.sign({ userId: 'guest-123', type: 'guest' })
    const headers = { authorization: `Bearer ${guestToken}` }

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/auth/me',
      headers,
      payload: { code: '000000' },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error).toContain('гостевой')
  })

  it('гость POST /me/delete-request → 403', async () => {
    const guestToken = app.jwt.sign({ userId: 'guest-123', type: 'guest' })
    const headers = { authorization: `Bearer ${guestToken}` }

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/me/delete-request',
      headers,
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error).toContain('гостевой')
  })

  it('сотрудник DELETE /me → 403', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Админ',
        email: 'admin@test.com',
        role: 'super_admin',
      },
    })
    const headers = authHeader(app, user.id, 'super_admin')

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/auth/me',
      headers,
      payload: { code: '000000' },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error).toContain('сотрудника')
  })

  it('сотрудник POST /me/delete-request → 403', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Админ',
        email: 'admin@test.com',
        role: 'super_admin',
      },
    })
    const headers = authHeader(app, user.id, 'super_admin')

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/me/delete-request',
      headers,
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error).toContain('сотрудника')
  })

  it('GET /me/export возвращает JSON с attachment', async () => {
    const user = await createUser({ name: 'Экспортный' })
    const { product, variant } = await createProductWithVariant()

    // Создать несколько записей
    await prisma.address.create({
      data: {
        userId: user.id,
        label: 'Офис',
        city: 'СПб',
        street: 'Невский',
        house: '10',
        postalCode: '191000',
      },
    })

    await prisma.order.create({
      data: {
        userId: user.id,
        status: 'delivered',
        deliveryMethod: 'pickup',
        subtotal: 10000,
        total: 10000,
        items: {
          create: {
            productVariantId: variant.id,
            productId: product.id,
            productName: product.name,
            variantWeight: variant.weight,
            price: variant.price,
            quantity: 1,
          },
        },
      },
    })

    const headers = authHeader(app, user.id)
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me/export',
      headers,
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')
    expect(res.headers['content-disposition']).toContain('attachment')
    expect(res.headers['content-disposition']).toContain('simba-data-')
    expect(res.headers['content-disposition']).toContain('.json')

    const data = res.json()
    expect(data.user.id).toBe(user.id)
    expect(data.user.name).toBe('Экспортный')
    expect(data.user.email).toBeDefined()
    expect(data.user.passwordHash).toBeUndefined() // хэш не экспортируется
    expect(Array.isArray(data.addresses)).toBe(true)
    expect(data.addresses.length).toBe(1)
    expect(Array.isArray(data.orders)).toBe(true)
    expect(data.orders[0].items).toBeDefined()
    expect(Array.isArray(data.consents)).toBe(true)
    expect(Array.isArray(data.bonusTransactions)).toBe(true)
  })

  it('гость GET /me/export → 403', async () => {
    const guestToken = app.jwt.sign({ userId: 'guest-456', type: 'guest' })
    const headers = { authorization: `Bearer ${guestToken}` }

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me/export',
      headers,
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error).toContain('гостевой')
  })

  it('admin POST /:id/anonymize работает', async () => {
    const user = await createUser({ name: 'Жертва' })
    const admin = await prisma.user.create({
      data: {
        name: 'Админ',
        email: 'admin@test.com',
        role: 'super_admin',
      },
    })
    const adminHeaders = authHeader(app, admin.id, 'super_admin')

    // Первый раз — 200
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${user.id}/anonymize`,
      headers: adminHeaders,
    })

    expect(res1.statusCode).toBe(200)
    expect(res1.json()).toEqual({ ok: true, alreadyDeleted: false })

    // Второй раз — alreadyDeleted: true
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${user.id}/anonymize`,
      headers: adminHeaders,
    })

    expect(res2.statusCode).toBe(200)
    expect(res2.json()).toEqual({ ok: true, alreadyDeleted: true })
  })

  it('admin не может обезличить себя', async () => {
    const admin = await prisma.user.create({
      data: {
        name: 'Админ',
        email: 'admin@test.com',
        role: 'super_admin',
      },
    })
    const adminHeaders = authHeader(app, admin.id, 'super_admin')

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${admin.id}/anonymize`,
      headers: adminHeaders,
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('себя')
  })

  it('обезличенный пользователь не в type=guests/registered', async () => {
    const user = await createUser({ name: 'Удаляем' })
    const admin = await prisma.user.create({
      data: {
        name: 'Админ',
        email: 'admin@test.com',
        role: 'super_admin',
      },
    })
    const adminHeaders = authHeader(app, admin.id, 'super_admin')

    // Создать заказ чтобы пользователь попал в registered
    const { product, variant } = await createProductWithVariant()
    await prisma.order.create({
      data: {
        userId: user.id,
        status: 'new',
        deliveryMethod: 'pickup',
        subtotal: 10000,
        total: 10000,
        items: {
          create: {
            productVariantId: variant.id,
            productId: product.id,
            productName: product.name,
            variantWeight: variant.weight,
            price: variant.price,
            quantity: 1,
          },
        },
      },
    })

    // Обезличить
    await app.inject({
      method: 'POST',
      url: `/api/admin/users/${user.id}/anonymize`,
      headers: adminHeaders,
    })

    // Проверить что не в registered
    const registeredRes = await app.inject({
      method: 'GET',
      url: '/api/admin/users?type=registered',
      headers: adminHeaders,
    })
    const ids = registeredRes.json().items.map((u: any) => u.id)
    expect(ids).not.toContain(user.id)

    // Не в guests
    const guestsRes = await app.inject({
      method: 'GET',
      url: '/api/admin/users?type=guests',
      headers: adminHeaders,
    })
    const guestIds = guestsRes.json().items.map((u: any) => u.id)
    expect(guestIds).not.toContain(user.id)

    // Но в all с isDeleted: true
    const allRes = await app.inject({
      method: 'GET',
      url: '/api/admin/users?type=all',
      headers: adminHeaders,
    })
    const deletedUser = allRes.json().items.find((u: any) => u.id === user.id)
    expect(deletedUser).toBeTruthy()
    expect(deletedUser.isDeleted).toBe(true)
    expect(deletedUser.deletedAt).toBeTruthy()
  })

  it('DELETE /me без кода → 400', async () => {
    const user = await createUser()
    const headers = authHeader(app, user.id)

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/auth/me',
      headers,
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('код из письма')
  })

  it('DELETE /me с неверным кодом → 400 и аккаунт не удален', async () => {
    const user = await createUser()
    const headers = authHeader(app, user.id)

    // Запросить удаление
    await app.inject({
      method: 'POST',
      url: '/api/auth/me/delete-request',
      headers,
    })

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/auth/me',
      headers,
      payload: { code: '999999' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('Неверный или просроченный код')

    // Проверить что аккаунт не удален
    const freshUser = await prisma.user.findUnique({ where: { id: user.id } })
    expect(freshUser?.isActive).toBe(true)
    expect(freshUser?.deletedAt).toBeNull()
  })

  it('POST /me/delete-request повторный в течение 60с → 429', async () => {
    const user = await createUser()
    const headers = authHeader(app, user.id)

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/auth/me/delete-request',
      headers,
    })
    expect(res1.statusCode).toBe(200)

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/auth/me/delete-request',
      headers,
    })
    expect(res2.statusCode).toBe(429)
    expect(res2.json().error).toContain('Повторный запрос возможен через 60 секунд')
  })

  it('DELETE /me с 5+ неверными попытками → 429 на 15 минут', async () => {
    const user = await createUser()
    const headers = authHeader(app, user.id)

    // Запросить удаление
    await app.inject({
      method: 'POST',
      url: '/api/auth/me/delete-request',
      headers,
    })

    // 5 неверных попыток
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/auth/me',
        headers,
        payload: { code: `${i}${i}${i}${i}${i}${i}` },
      })
      expect(res.statusCode).toBe(400)
    }

    // 6-я попытка → 429
    const blocked = await app.inject({
      method: 'DELETE',
      url: '/api/auth/me',
      headers,
      payload: { code: '999999' },
    })
    expect(blocked.statusCode).toBe(429)
    expect(blocked.json().error).toContain('Слишком много попыток')
  })
})
