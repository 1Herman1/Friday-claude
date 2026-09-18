import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createProductWithVariant, createCart } from './factories'
import {
  countStaleGuests,
  runGuestCleanup,
  runGuestCleanupTracked,
} from '../services/guest-cleanup.service'
import { startRun, RunAlreadyRunningError } from '../services/run-history'

const DAY = 86400000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY)

/**
 * Даты выставляются напрямую через Prisma, а не походом по API гостевым токеном:
 * любой аутентифицированный запрос теперь обновляет lastSeenAt, и гость
 * мгновенно перестанет быть кандидатом на удаление.
 */
describe.skipIf(!hasTestDb)('Чистка гостевых записей (интеграционные)', () => {
  let prisma: PrismaClient

  beforeAll(() => {
    prisma = getTestPrisma()
  })

  afterAll(async () => {
    await closeTestPrisma()
  })

  beforeEach(async () => {
    await resetDb()
  })

  async function createGuest(data: {
    name?: string
    createdAt?: Date
    lastSeenAt?: Date | null
    deletedAt?: Date | null
  } = {}) {
    return prisma.user.create({
      data: {
        name: data.name ?? 'Гость',
        welcomeBonusGranted: true,
        createdAt: data.createdAt ?? daysAgo(40),
        lastSeenAt: data.lastSeenAt ?? null,
        deletedAt: data.deletedAt ?? null,
      },
    })
  }

  const exists = async (id: string) =>
    (await prisma.user.findUnique({ where: { id }, select: { id: true } })) !== null

  it('не удаляет гостя, созданного 40 дней назад, но заходившего вчера', async () => {
    const active = await createGuest({ createdAt: daysAgo(40), lastSeenAt: daysAgo(1) })

    const report = await runGuestCleanup(prisma, 30, false)

    expect(report.deleted).toBe(0)
    expect(await exists(active.id)).toBe(true)
  })

  it('удаляет гостя с пустым lastSeenAt и старым createdAt (записи до выкатки)', async () => {
    const legacy = await createGuest({ createdAt: daysAgo(40), lastSeenAt: null })

    const report = await runGuestCleanup(prisma, 30, false)

    expect(report.deleted).toBe(1)
    expect(await exists(legacy.id)).toBe(false)
  })

  it('удаляет гостя, не заходившего 40 дней, даже если запись свежая', async () => {
    const stale = await createGuest({ createdAt: daysAgo(1), lastSeenAt: daysAgo(40) })

    const report = await runGuestCleanup(prisma, 30, false)

    expect(report.deleted).toBe(1)
    expect(await exists(stale.id)).toBe(false)
  })

  it('не удаляет обезличенный аккаунт: он внешне неотличим от гостя', async () => {
    const anonymized = await prisma.user.create({
      data: {
        name: 'Удалённый пользователь',
        createdAt: daysAgo(90),
        lastSeenAt: daysAgo(90),
        deletedAt: daysAgo(60),
      },
    })

    expect(await countStaleGuests(prisma, 30)).toBe(0)

    const report = await runGuestCleanup(prisma, 30, false)

    expect(report.deleted).toBe(0)
    expect(await exists(anonymized.id)).toBe(true)
  })

  it('сохраняет согласие удалённого гостя, обнуляя userId, ip и userAgent', async () => {
    const guest = await createGuest({ createdAt: daysAgo(40) })
    const consent = await prisma.consent.create({
      data: {
        userId: guest.id,
        kind: 'pd_processing',
        textVersion: 'v1',
        ip: '203.0.113.7',
        userAgent: 'Mozilla/5.0 (тестовый браузер)',
      },
    })

    const report = await runGuestCleanup(prisma, 30, false)

    expect(report.deleted).toBe(1)
    expect(report.consentsCleared).toBe(1)
    expect(await exists(guest.id)).toBe(false)

    const after = await prisma.consent.findUnique({ where: { id: consent.id } })
    expect(after).not.toBeNull()
    expect(after?.userId).toBeNull()
    expect(after?.ip).toBeNull()
    expect(after?.userAgent).toBeNull()
  })

  it('удаляет гостя с пустой корзиной и щадит гостя с товаром в корзине', async () => {
    const withEmptyCart = await createGuest({ name: 'Пустая корзина' })
    await prisma.cart.create({ data: { userId: withEmptyCart.id } })

    const withItems = await createGuest({ name: 'Корзина с товаром' })
    const { variant } = await createProductWithVariant()
    await createCart(withItems.id, [{ variantId: variant.id, quantity: 1 }])

    const report = await runGuestCleanup(prisma, 30, false)

    expect(report.deleted).toBe(1)
    expect(await exists(withEmptyCart.id)).toBe(false)
    expect(await exists(withItems.id)).toBe(true)
  })

  it('не трогает гостей с заказом, избранным или подбором', async () => {
    const { product, variant } = await createProductWithVariant()

    const withOrder = await createGuest({ name: 'С заказом' })
    await prisma.order.create({
      data: {
        userId: withOrder.id,
        status: 'new',
        deliveryMethod: 'pickup',
        subtotal: 10000,
        total: 10000,
      },
    })

    const withFavorite = await createGuest({ name: 'С избранным' })
    await prisma.favorite.create({
      data: { userId: withFavorite.id, productId: product.id },
    })

    const withQuiz = await createGuest({ name: 'С подбором' })
    await prisma.quizSession.create({
      data: {
        userId: withQuiz.id,
        species: 'cat',
        answers: {},
        tags: [],
        resultProductIds: [variant.productId],
      },
    })

    expect(await countStaleGuests(prisma, 30)).toBe(0)

    const report = await runGuestCleanup(prisma, 30, false)

    expect(report.deleted).toBe(0)
    expect(await exists(withOrder.id)).toBe(true)
    expect(await exists(withFavorite.id)).toBe(true)
    expect(await exists(withQuiz.id)).toBe(true)
  })

  it('предпросмотр считает кандидатов, но ничего не удаляет', async () => {
    const guest = await createGuest({ createdAt: daysAgo(40) })

    const report = await runGuestCleanup(prisma, 30, true)

    expect(report.dryRun).toBe(true)
    expect(report.candidates).toBe(1)
    expect(report.taken).toBe(1)
    expect(report.deleted).toBe(0)
    expect(report.sample).toHaveLength(1)
    expect(report.sample[0].id).toBe(guest.id)
    expect(await exists(guest.id)).toBe(true)
  })

  it('удаляет 250 гостей несколькими батчами по 100', async () => {
    const rows = Array.from({ length: 250 }, (_, i) => ({
      name: `Гость ${i}`,
      welcomeBonusGranted: true,
      createdAt: daysAgo(40 + (i % 5)),
    }))
    await prisma.user.createMany({ data: rows })

    expect(await countStaleGuests(prisma, 30)).toBe(250)

    const report = await runGuestCleanup(prisma, 30, false)

    expect(report.candidates).toBe(250)
    expect(report.taken).toBe(250)
    expect(report.deleted).toBe(250)
    expect(report.skippedChunks).toBe(0)
    expect(report.errors).toHaveLength(0)
    expect(report.hasMore).toBe(false)
    expect(await prisma.user.count()).toBe(0)
  })

  it('порог days: при 365 днях 40-дневный гость остаётся', async () => {
    const guest = await createGuest({ createdAt: daysAgo(40) })

    expect(await countStaleGuests(prisma, 365)).toBe(0)
    const report = await runGuestCleanup(prisma, 365, false)

    expect(report.deleted).toBe(0)
    expect(await exists(guest.id)).toBe(true)
  })

  it('runGuestCleanupTracked пишет прогон в sync_runs с source=guest_cleanup', async () => {
    await createGuest({ createdAt: daysAgo(40) })

    const report = await runGuestCleanupTracked(prisma, 30, false)

    expect(report.deleted).toBe(1)

    const run = await prisma.syncRun.findFirst({
      where: { source: 'guest_cleanup' },
      orderBy: { startedAt: 'desc' },
    })

    expect(run).not.toBeNull()
    expect(run?.source).toBe('guest_cleanup')
    expect(run?.status).toBe('success')
    expect(run?.finishedAt).not.toBeNull()
    expect((run?.report as { deleted?: number } | null)?.deleted).toBe(1)
    // счётчики МойСклада остаются нулями — число гостей туда писать нельзя
    expect(run?.itemsFromMs).toBe(0)
    expect(run?.priceUpdated).toBe(0)
  })

  it('лок скоупится по source: занятая чистка не мешает МойСкладу и наоборот', async () => {
    const cleanupRunId = await startRun(prisma, 'guest_cleanup', 'cron', false)
    expect(cleanupRunId).toBeTruthy()

    // второй прогон того же источника упирается в лок
    await expect(startRun(prisma, 'guest_cleanup', 'admin', false)).rejects.toBeInstanceOf(
      RunAlreadyRunningError
    )

    // чужой источник стартует свободно
    const moyskladRunId = await startRun(prisma, 'moysklad', 'cron', false)
    expect(moyskladRunId).toBeTruthy()
    expect(moyskladRunId).not.toBe(cleanupRunId)

    // и обратно: занятый МойСклад не мешает чистке
    await expect(startRun(prisma, 'moysklad', 'admin', false)).rejects.toBeInstanceOf(
      RunAlreadyRunningError
    )

    await prisma.syncRun.update({
      where: { id: cleanupRunId },
      data: { status: 'success', finishedAt: new Date() },
    })
    const secondCleanup = await startRun(prisma, 'guest_cleanup', 'cron', false)
    expect(secondCleanup).toBeTruthy()
  })
})
