import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
const { sign } = jwt
import prismaPlugin from '../plugins/prisma.js'
import authenticatePlugin from '../plugins/authenticate.js'
import { ApiError, errorResponse } from '../lib/errors.js'
import { registerCommonSchemas } from '../schemas/common.js'
import adminRoutes from '../routes/admin/index.js'
import publicVideoReviewsRoutes from '../routes/video-reviews.js'
import { db, type Prisma } from '../lib/db.js'
import { videoReviewsDir, videoConsentsDir } from '../lib/env.js'

// Публикуемость видеоотзыва и защита админки. Отзывы засеваются прямо в базу
// (с файлами-заглушками), поэтому набор не зависит от ffmpeg.

const DOMAIN = '@ps-vpubtest.local'
const AUTHOR = 'VPUB '
const PRODUCT_SLUG = `vpub-product-${Date.now()}`
const PREFIX = '/uploads/video-reviews/'
const DAY = 24 * 60 * 60 * 1000

let app: FastifyInstance
const staff: Record<string, { id: string; token: string }> = {}
const createdFiles: string[] = []
const createdDocs: string[] = []
let productId = ''

async function build() {
  const instance = Fastify()
  registerCommonSchemas(instance)
  await instance.register(prismaPlugin)
  await instance.register(cookie, { secret: 'test-secret', hook: 'preHandler' })
  await instance.register(rateLimit, { max: 10000, timeWindow: '1 minute' })
  await instance.register(multipart)
  await instance.register(authenticatePlugin)

  instance.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.status).send(errorResponse(error))
    }
    if ((error as { validation?: unknown }).validation) {
      return reply.status(400).send(errorResponse(new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')))
    }
    instance.log.error({ error, requestId: request.id })
    reply.status(500).send(errorResponse(new ApiError(500, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера')))
  })

  await instance.register(publicVideoReviewsRoutes, { prefix: '/api/v1' })
  await instance.register(adminRoutes)
  return instance
}

async function makeStaff(role: string) {
  const email = `staff-${role}-${Date.now()}-${Math.random().toString(36).slice(2)}${DOMAIN}`
  const user = await db.user.create({ data: { email, name: `Staff ${role}`, role: role as never } })
  const token = sign({ userId: user.id, role: user.role, tv: user.tokenVersion }, process.env.JWT_SECRET || 'dev-secret', {
    expiresIn: '1d',
  })
  return { id: user.id, token }
}

async function api(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, token?: string, payload?: unknown) {
  return app.inject({
    method,
    url,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: payload as object | undefined,
  })
}

async function exists(path: string) {
  return stat(path).then(
    () => true,
    () => false,
  )
}

async function stubMedia(ext: string) {
  const name = `${randomUUID()}.${ext}`
  await mkdir(videoReviewsDir, { recursive: true })
  await writeFile(join(videoReviewsDir, name), 'stub')
  createdFiles.push(name)
  return `${PREFIX}${name}`
}

async function stubConsentDoc() {
  const name = `${randomUUID()}.pdf`
  await mkdir(videoConsentsDir, { recursive: true })
  await writeFile(join(videoConsentsDir, name), '%PDF-1.4 stub')
  createdDocs.push(name)
  return name
}

/** Опубликованный отзыв со всеми условиями; overrides — то, что тест хочет сломать. */
async function seedPublished(overrides: Prisma.VideoReviewUncheckedCreateInput | object = {}) {
  const now = new Date()
  return db.videoReview.create({
    data: {
      authorName: `${AUTHOR}${randomUUID().slice(0, 8)}`,
      mp4Url: await stubMedia('mp4'),
      webmUrl: await stubMedia('webm'),
      posterUrl: await stubMedia('jpg'),
      consentDocPath: await stubConsentDoc(),
      consentConfirmed: true,
      consentConfirmedAt: now,
      consentConfirmedById: staff.super.id,
      consentAllowSite: true,
      contentReviewed: true,
      contentReviewedAt: now,
      contentReviewedById: staff.super.id,
      isActive: true,
      ...overrides,
    },
  })
}

async function publicIds() {
  const res = await app.inject({ method: 'GET', url: '/api/v1/video-reviews?limit=20' })
  expect(res.statusCode).toBe(200)
  return (JSON.parse(res.body).items as Array<{ id: string }>).map((item) => item.id)
}

describe('Video reviews: publication and protection', () => {
  beforeAll(async () => {
    app = await build()
    staff.super = await makeStaff('super_admin')
    staff.content = await makeStaff('content_manager')
    staff.customer = await makeStaff('customer')
    // Чужие отзывы из других наборов не должны вытеснять наши за предел limit=20.
    await db.videoReview.updateMany({ where: { authorName: { startsWith: AUTHOR } }, data: { isActive: false } })
    const product = await db.product.create({ data: { name: 'VPUB Product', slug: PRODUCT_SLUG, description: 'тест' } })
    await db.productVariant.create({ data: { productId: product.id, volumeValue: 50, retailPrice: 100000, stock: 1 } })
    productId = product.id
  })

  afterAll(async () => {
    await db.videoReview.deleteMany({ where: { authorName: { startsWith: AUTHOR } } })
    for (const name of createdFiles) await rm(join(videoReviewsDir, name), { force: true })
    for (const name of createdDocs) await rm(join(videoConsentsDir, name), { force: true })
    await db.productVariant.deleteMany({ where: { product: { slug: PRODUCT_SLUG } } })
    await db.product.deleteMany({ where: { slug: PRODUCT_SLUG } })
    await db.user.deleteMany({ where: { email: { endsWith: DOMAIN } } })
    await app.close()
  })

  describe('публичная выдача', () => {
    it('готовый опубликованный отзыв виден, с товаром', async () => {
      const row = await seedPublished({ productId })
      const res = await app.inject({ method: 'GET', url: '/api/v1/video-reviews?limit=20' })
      const mine = JSON.parse(res.body).items.find((item: { id: string }) => item.id === row.id)
      expect(mine).toMatchObject({ authorName: row.authorName, mp4Url: row.mp4Url, posterUrl: row.posterUrl })
      expect(mine.product).toEqual({ slug: PRODUCT_SLUG, name: 'VPUB Product' })
    })

    it('ответ не содержит ни одного поля согласия, проверки и служебных полей', async () => {
      await seedPublished({ consentNote: 'Оригинал в сейфе', consentTemplateVersion: '2026-10' })
      const res = await app.inject({ method: 'GET', url: '/api/v1/video-reviews?limit=20' })
      const items = JSON.parse(res.body).items as Array<Record<string, unknown>>
      expect(items.length).toBeGreaterThan(0)
      for (const item of items) {
        expect(Object.keys(item).sort()).toEqual(['authorName', 'caption', 'id', 'mp4Url', 'posterUrl', 'product', 'webmUrl'])
      }
      expect(res.body).not.toMatch(/consent|contentReviewed|isActive|sortOrder|ById|Оригинал в сейфе/)
    })

    it('готовый, но не опубликованный (isActive=false) — не виден', async () => {
      const row = await seedPublished({ isActive: false })
      expect(await publicIds()).not.toContain(row.id)
    })

    it('срок согласия истёк, а флаг публикации ещё стоит — не виден', async () => {
      const row = await seedPublished({ consentExpiresAt: new Date(Date.now() - 1000) })
      expect(await publicIds()).not.toContain(row.id)
    })

    it('срок согласия в будущем — виден', async () => {
      const row = await seedPublished({ consentExpiresAt: new Date(Date.now() + 30 * DAY) })
      expect(await publicIds()).toContain(row.id)
    })

    it('удалённый товар не раскрывается: product = null, сам отзыв виден', async () => {
      const product = await db.product.create({
        data: { name: 'VPUB Gone', slug: `${PRODUCT_SLUG}-gone`, description: 'тест', deletedAt: new Date() },
      })
      const row = await seedPublished({ productId: product.id })
      const res = await app.inject({ method: 'GET', url: '/api/v1/video-reviews?limit=20' })
      const mine = JSON.parse(res.body).items.find((item: { id: string }) => item.id === row.id)
      expect(mine.product).toBeNull()
      await db.videoReview.update({ where: { id: row.id }, data: { productId: null } })
      await db.product.delete({ where: { id: product.id } })
    })

    it.each(['0', '21', 'abc'])('limit=%s — 400', async (limit) => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/video-reviews?limit=${limit}` })
      expect(res.statusCode).toBe(400)
    })

    it('CHECK в базе не пускает в опубликованные отзыв без любого из условий', async () => {
      const broken: Array<Record<string, unknown>> = [
        { mp4Url: null },
        { posterUrl: null },
        { consentDocPath: null },
        { consentAllowSite: false },
        { consentConfirmed: false, consentConfirmedAt: null, consentConfirmedById: null },
        { contentReviewed: false, contentReviewedAt: null, contentReviewedById: null },
        { consentRevokedAt: new Date(), consentRevokedById: staff.super.id },
        { deletedAt: new Date() },
      ]
      for (const overrides of broken) {
        await expect(seedPublished(overrides)).rejects.toThrow()
      }
    })
  })

  describe('снятие условия у опубликованного отзыва', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['сайт не разрешён', { consentAllowSite: false }],
      ['содержание не проверено', { contentReviewed: false }],
      ['согласие не подтверждено', { consentConfirmed: false }],
      ['срок согласия истёк', { consentExpiresAt: '2000-01-01' }],
      ['согласие отозвано', { consentRevoked: true }],
    ]

    it.each(cases)('%s — 200, публикация снята, в выдаче нет', async (_name, patch) => {
      const row = await seedPublished()
      expect(await publicIds()).toContain(row.id)

      const res = await api('PATCH', `/api/v1/admin/video-reviews/${row.id}`, staff.content.token, patch)
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).isActive).toBe(false)
      expect(await publicIds()).not.toContain(row.id)
    })

    it.each(cases.filter(([name]) => name !== 'согласие отозвано'))(
      '%s вместе с isActive:true (как шлёт форма) — 409 VIDEO_NOT_READY, не 500',
      async (_name, patch) => {
        const row = await seedPublished()
        const res = await api('PATCH', `/api/v1/admin/video-reviews/${row.id}`, staff.content.token, { ...patch, isActive: true })
        expect(res.statusCode).toBe(409)
        expect(JSON.parse(res.body).error.code).toBe('VIDEO_NOT_READY')
      },
    )

    it('удаление: из выдачи пропадает, видео и постер стёрты, документ согласия остался', async () => {
      const row = await seedPublished()
      const res = await api('DELETE', `/api/v1/admin/video-reviews/${row.id}`, staff.content.token)
      expect(res.statusCode).toBe(204)
      expect(await publicIds()).not.toContain(row.id)
      for (const url of [row.mp4Url, row.webmUrl, row.posterUrl]) {
        expect(await exists(join(videoReviewsDir, url!.slice(PREFIX.length)))).toBe(false)
      }
      expect(await exists(join(videoConsentsDir, row.consentDocPath!))).toBe(true)
    })
  })

  describe('отзыв согласия', () => {
    it('стирает mp4, webm и постер с диска, обнуляет URL, документ согласия оставляет', async () => {
      const row = await seedPublished()
      const files = [row.mp4Url, row.webmUrl, row.posterUrl].map((url) => join(videoReviewsDir, url!.slice(PREFIX.length)))
      for (const file of files) expect(await exists(file)).toBe(true)

      const res = await api('PATCH', `/api/v1/admin/video-reviews/${row.id}`, staff.content.token, { consentRevoked: true })
      expect(res.statusCode).toBe(200)

      for (const file of files) expect(await exists(file)).toBe(false)
      const stored = await db.videoReview.findUniqueOrThrow({ where: { id: row.id } })
      expect(stored).toMatchObject({ mp4Url: null, webmUrl: null, posterUrl: null, isActive: false, consentConfirmed: false })
      expect(stored.consentRevokedById).toBe(staff.content.id)
      expect(await exists(join(videoConsentsDir, row.consentDocPath!))).toBe(true)
    })

    it('после отзыва повторное подтверждение без нового документа — 409 CONSENT_REVOKED', async () => {
      const row = await seedPublished()
      await api('PATCH', `/api/v1/admin/video-reviews/${row.id}`, staff.content.token, { consentRevoked: true })
      const res = await api('PATCH', `/api/v1/admin/video-reviews/${row.id}`, staff.content.token, { consentConfirmed: true })
      expect(res.statusCode).toBe(409)
      expect(JSON.parse(res.body).error.code).toBe('CONSENT_REVOKED')
    })
  })

  describe('след подтверждения', () => {
    it('повторное сохранение формы другим менеджером не переписывает, кто и когда подтвердил согласие и проверку', async () => {
      const confirmedAt = new Date(Date.now() - 10 * DAY)
      const row = await seedPublished({ consentConfirmedAt: confirmedAt, contentReviewedAt: confirmedAt })

      // Форма админки шлёт все поля целиком, включая уже стоящие галочки.
      const res = await api('PATCH', `/api/v1/admin/video-reviews/${row.id}`, staff.content.token, {
        caption: 'Поправили подпись',
        consentConfirmed: true,
        contentReviewed: true,
        isActive: true,
      })
      expect(res.statusCode).toBe(200)

      const stored = await db.videoReview.findUniqueOrThrow({ where: { id: row.id } })
      expect(stored.consentConfirmedById).toBe(staff.super.id)
      expect(stored.consentConfirmedAt?.toISOString()).toBe(confirmedAt.toISOString())
      expect(stored.contentReviewedById).toBe(staff.super.id)
      expect(stored.contentReviewedAt?.toISOString()).toBe(confirmedAt.toISOString())
    })
  })

  describe('защита: тело запроса', () => {
    const forbidden: Array<[string, unknown]> = [
      ['mp4Url', '/uploads/video-reviews/evil.mp4'],
      ['webmUrl', '/uploads/video-reviews/evil.webm'],
      ['posterUrl', '/uploads/video-reviews/evil.jpg'],
      ['consentDocPath', '../../etc/passwd'],
      ['sortOrder', 0],
      ['consentConfirmedAt', '2026-01-01T00:00:00.000Z'],
      ['consentConfirmedById', 'self'],
      ['contentReviewedAt', '2026-01-01T00:00:00.000Z'],
      ['contentReviewedById', 'self'],
      ['consentRevokedAt', null],
      ['consentRevokedById', null],
      ['deletedAt', null],
      ['createdAt', '2026-01-01T00:00:00.000Z'],
      ['id', '00000000-0000-0000-0000-000000000000'],
    ]

    it.each(forbidden)('PATCH с полем %s — 400, запись не меняется', async (field, value) => {
      const row = await seedPublished({ isActive: false })
      const payload = { [field]: value === 'self' ? staff.content.id : value }
      const res = await api('PATCH', `/api/v1/admin/video-reviews/${row.id}`, staff.content.token, payload)
      expect(res.statusCode).toBe(400)

      const stored = await db.videoReview.findUniqueOrThrow({ where: { id: row.id } })
      expect(stored).toEqual(row)
    })

    it('POST создания не принимает готовность и URL из тела', async () => {
      for (const extra of [{ isActive: true }, { consentConfirmed: true }, { contentReviewed: true }, { mp4Url: '/x.mp4' }, { sortOrder: 0 }]) {
        const res = await api('POST', '/api/v1/admin/video-reviews', staff.content.token, { authorName: `${AUTHOR}post`, ...extra })
        expect(res.statusCode).toBe(400)
      }
    })

    it('несуществующий товар при создании — 404, отзыв не создаётся', async () => {
      const name = `${AUTHOR}no-product-${Date.now()}`
      const res = await api('POST', '/api/v1/admin/video-reviews', staff.content.token, {
        authorName: name,
        productId: randomUUID(),
      })
      expect(res.statusCode).toBe(404)
      expect(await db.videoReview.count({ where: { authorName: name } })).toBe(0)
    })
  })

  describe('защита: доступ', () => {
    it('без входа — 401 на список, правку, документ согласия', async () => {
      const row = await seedPublished({ isActive: false })
      expect((await api('GET', '/api/v1/admin/video-reviews')).statusCode).toBe(401)
      expect((await api('PATCH', `/api/v1/admin/video-reviews/${row.id}`, undefined, { isActive: false })).statusCode).toBe(401)
      expect((await api('GET', `/api/v1/admin/video-reviews/${row.id}/consent-doc`)).statusCode).toBe(401)
    })

    it('покупатель — 403 на правку, отзыв согласия, удаление и скачивание документа', async () => {
      const row = await seedPublished()
      const token = staff.customer.token
      expect((await api('PATCH', `/api/v1/admin/video-reviews/${row.id}`, token, { caption: 'x' })).statusCode).toBe(403)
      expect((await api('PATCH', `/api/v1/admin/video-reviews/${row.id}`, token, { consentRevoked: true })).statusCode).toBe(403)
      expect((await api('DELETE', `/api/v1/admin/video-reviews/${row.id}`, token)).statusCode).toBe(403)
      expect((await api('GET', `/api/v1/admin/video-reviews/${row.id}/consent-doc`, token)).statusCode).toBe(403)

      const stored = await db.videoReview.findUniqueOrThrow({ where: { id: row.id } })
      expect(stored).toEqual(row)
    })

    it('админский ответ не выдаёт путь к документу согласия', async () => {
      const row = await seedPublished()
      const res = await api('GET', `/api/v1/admin/video-reviews/${row.id}`, staff.content.token)
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.hasConsentDoc).toBe(true)
      expect(body).not.toHaveProperty('consentDocPath')
      expect(res.body).not.toContain(row.consentDocPath!)
    })
  })
})
