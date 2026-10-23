import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import jwt from 'jsonwebtoken'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const { sign } = jwt
import prismaPlugin from '../plugins/prisma.js'
import authenticatePlugin from '../plugins/authenticate.js'
import { ApiError, errorResponse } from '../lib/errors.js'
import { registerCommonSchemas } from '../schemas/common.js'
import adminRoutes from '../routes/admin/index.js'
import publicVideoReviewsRoutes from '../routes/video-reviews.js'
import { db } from '../lib/db.js'
import { videoReviewsDir, videoConsentsDir } from '../lib/env.js'

const DOMAIN = '@ps-videotest.local'
const AUTHOR = 'VT '
const PRODUCT_SLUG = `vt-test-product-${Date.now()}`
const FFMPEG_OK = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0

let app: FastifyInstance
let dir = ''
const staff: Record<string, { id: string; token: string }> = {}
const fixtures: Record<string, Buffer> = {}
const createdUrls: string[] = []
const createdConsentDocs: string[] = []

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
    if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.status(413).send(errorResponse(new ApiError(413, 'FILE_TOO_LARGE', 'Файл слишком большой')))
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

function ffmpeg(args: string[]) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args])
}

function multipartBody(data: Buffer, filename: string, mime: string) {
  const boundary = `----vtboundary${Math.random().toString(16).slice(2)}`
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  return {
    payload: Buffer.concat([head, data, tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  }
}

async function api(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, token: string, payload?: unknown) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload: payload as object | undefined })
}

async function upload(url: string, token: string, data: Buffer, filename: string, mime: string) {
  const body = multipartBody(data, filename, mime)
  return app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}`, ...body.headers }, payload: body.payload })
}

async function exists(path: string) {
  return stat(path).then(
    () => true,
    () => false,
  )
}

function fileOf(url: string) {
  return join(videoReviewsDir, url.replace('/uploads/video-reviews/', ''))
}

async function createReview(name: string) {
  const res = await api('POST', '/api/v1/admin/video-reviews', staff.super.token, { authorName: `${AUTHOR}${name}` })
  expect(res.statusCode).toBe(201)
  return JSON.parse(res.body) as { id: string; sortOrder: number }
}

describe.skipIf(!FFMPEG_OK)('Video reviews integration', () => {
  let review: { id: string }
  let spare: { id: string; sortOrder: number }
  let product: { id: string }

  beforeAll(async () => {
    app = await build()
    staff.super = await makeStaff('super_admin')
    staff.content = await makeStaff('content_manager')
    staff.customer = await makeStaff('customer')

    dir = await mkdtemp(join(tmpdir(), 'ps-vt-'))
    const geo = join(dir, 'geo.mp4')
    ffmpeg(['-f', 'lavfi', '-i', 'testsrc=duration=1:size=320x240:rate=10', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-metadata', 'location=+55.7558+037.6173/', '-metadata', 'comment=secret note', '-f', 'mp4', geo])
    const webm = join(dir, 'clip.webm')
    ffmpeg(['-f', 'lavfi', '-i', 'testsrc=duration=1:size=320x240:rate=10', '-c:v', 'libvpx', '-b:v', '200k', '-f', 'webm', webm])
    const poster = join(dir, 'poster.jpg')
    ffmpeg(['-f', 'lavfi', '-i', 'testsrc=duration=1:size=320x240', '-frames:v', '1', poster])

    fixtures.mp4 = await readFile(geo)
    fixtures.h265 = Buffer.from(fixtures.mp4.toString('latin1').replaceAll('avc1', 'hvc1'), 'latin1')
    fixtures.webm = await readFile(webm)
    fixtures.poster = await readFile(poster)
    fixtures.pdf = Buffer.from('%PDF-1.4\n%consent document\n%%EOF\n', 'latin1')
    fixtures.gif = Buffer.from('GIF89a' + 'x'.repeat(64), 'latin1')

    const created = await db.product.create({
      data: { name: 'VT Test Product', slug: PRODUCT_SLUG, description: 'тест' },
    })
    await db.productVariant.create({
      data: { productId: created.id, volumeValue: 50, retailPrice: 100000, stock: 1 },
    })
    product = created
  })

  afterAll(async () => {
    const reviews = await db.videoReview.findMany({ where: { authorName: { startsWith: AUTHOR } }, select: { id: true } })
    for (const url of createdUrls) await rm(fileOf(url), { force: true })
    for (const name of createdConsentDocs) await rm(join(videoConsentsDir, name), { force: true })
    await db.videoReview.deleteMany({ where: { id: { in: reviews.map((item) => item.id) } } })
    await db.productVariant.deleteMany({ where: { product: { slug: PRODUCT_SLUG } } })
    await db.product.deleteMany({ where: { slug: PRODUCT_SLUG } })
    await db.user.deleteMany({ where: { email: { endsWith: DOMAIN } } })
    if (dir) await rm(dir, { recursive: true, force: true })
    await app.close()
  })

  it('создание: отзыв неактивен, порядок — следующий за последним', async () => {
    const res = await api('POST', '/api/v1/admin/video-reviews', staff.super.token, {
      authorName: `${AUTHOR}Анна, Москва`,
      caption: 'Кожа стала мягче',
      productId: product.id,
      consentTemplateVersion: '2026-10',
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body).toMatchObject({ isActive: false, hasConsentDoc: false, consentConfirmed: false, contentReviewed: false })
    expect(body.product).toMatchObject({ id: product.id, slug: PRODUCT_SLUG })
    review = { id: body.id }
    spare = await createReview('Второй')
    expect(spare.sortOrder).toBeGreaterThan(0)
  })

  it('публикация без условий — 409 с перечнем недостающего', async () => {
    const res = await api('PATCH', `/api/v1/admin/video-reviews/${review.id}`, staff.super.token, { isActive: true })
    expect(res.statusCode).toBe(409)
    const error = JSON.parse(res.body).error
    expect(error.code).toBe('VIDEO_NOT_READY')
    expect(error.details.missing).toEqual(expect.arrayContaining(['mp4', 'poster', 'consent', 'consentDoc', 'site', 'review']))
  })

  it('документ согласия: PDF принимается, GIF — нет', async () => {
    const bad = await upload(`/api/v1/admin/video-reviews/${review.id}/consent-doc`, staff.super.token, fixtures.gif, 'x.gif', 'image/gif')
    expect(bad.statusCode).toBe(400)

    const ok = await upload(`/api/v1/admin/video-reviews/${review.id}/consent-doc`, staff.super.token, fixtures.pdf, 'consent.pdf', 'application/pdf')
    expect(ok.statusCode).toBe(200)
    expect(JSON.parse(ok.body).hasConsentDoc).toBe(true)
    const stored = await db.videoReview.findUniqueOrThrow({ where: { id: review.id }, select: { consentDocPath: true } })
    createdConsentDocs.push(stored.consentDocPath!)
    expect(existsSync(join(videoConsentsDir, stored.consentDocPath!))).toBe(true)
  })

  it('подтверждение без документа — 409; ById из тела не принимается', async () => {
    const withoutDoc = await createReview('Без документа')
    const noDoc = await api('PATCH', `/api/v1/admin/video-reviews/${withoutDoc.id}`, staff.super.token, { consentConfirmed: true })
    expect(noDoc.statusCode).toBe(409)
    expect(JSON.parse(noDoc.body).error.code).toBe('CONSENT_DOC_MISSING')

    const forged = await api('PATCH', `/api/v1/admin/video-reviews/${review.id}`, staff.super.token, {
      consentConfirmed: true,
      consentConfirmedById: staff.content.id,
    })
    expect(forged.statusCode).toBe(400)

    const ok = await api('PATCH', `/api/v1/admin/video-reviews/${review.id}`, staff.super.token, {
      consentConfirmed: true,
      consentAllowSite: true,
      consentNote: 'Оригинал в папке согласий',
    })
    expect(ok.statusCode).toBe(200)
    expect(JSON.parse(ok.body).consentConfirmedBy).toEqual({ id: staff.super.id, name: 'Staff super_admin' })
  })

  it('H.265 отклоняется с понятным текстом', async () => {
    const res = await upload(`/api/v1/admin/video-reviews/${review.id}/media/mp4`, staff.super.token, fixtures.h265, 'h265.mp4', 'video/mp4')
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.message).toContain('H.265 не воспроизводится')
  })

  it('слот MP4 не принимает WebM', async () => {
    const res = await upload(`/api/v1/admin/video-reviews/${review.id}/media/mp4`, staff.super.token, fixtures.webm, 'clip.webm', 'video/webm')
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.message).toBe('Для MP4-слота нужен файл MP4 (H.264)')
  })

  it('MP4 загружается, геолокация и комментарий вычищаются, есть подсказка про постер', async () => {
    const res = await upload(`/api/v1/admin/video-reviews/${review.id}/media/mp4`, staff.super.token, fixtures.mp4, 'geo.mp4', 'video/mp4')
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.url).toMatch(/^\/uploads\/video-reviews\/[0-9a-f-]{36}\.mp4$/)
    expect(body.warnings).toContain('Нет постера: без него отзыв не публикуется')
    createdUrls.push(body.url)

    const probe = execFileSync('ffprobe', ['-v', 'error', '-show_format', '-of', 'json', fileOf(body.url)]).toString()
    const tags = JSON.parse(probe).format.tags ?? {}
    expect(Object.keys(tags).some((key) => key.includes('location'))).toBe(false)
    expect(Object.values(tags)).not.toContain('secret note')
  })

  it('постер больше 3 МБ — 413 FILE_TOO_LARGE', async () => {
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(3 * 1024 * 1024)])
    const res = await upload(`/api/v1/admin/video-reviews/${review.id}/media/poster`, staff.super.token, big, 'big.jpg', 'image/jpeg')
    expect(res.statusCode).toBe(413)
    expect(JSON.parse(res.body).error.code).toBe('FILE_TOO_LARGE')
  })

  it('постер JPEG и WebM загружаются', async () => {
    const poster = await upload(`/api/v1/admin/video-reviews/${review.id}/media/poster`, staff.super.token, fixtures.poster, 'poster.jpg', 'image/jpeg')
    expect(poster.statusCode).toBe(200)
    expect(JSON.parse(poster.body).url).toMatch(/\.jpg$/)
    createdUrls.push(JSON.parse(poster.body).url)

    const webm = await upload(`/api/v1/admin/video-reviews/${review.id}/media/webm`, staff.super.token, fixtures.webm, 'clip.webm', 'video/webm')
    expect(webm.statusCode).toBe(200)
    createdUrls.push(JSON.parse(webm.body).url)
  })

  it('публикация после полного набора — 200', async () => {
    const review2 = await api('PATCH', `/api/v1/admin/video-reviews/${review.id}`, staff.super.token, { contentReviewed: true })
    expect(review2.statusCode).toBe(200)
    expect(JSON.parse(review2.body).contentReviewedAt).not.toBeNull()

    const active = await api('PATCH', `/api/v1/admin/video-reviews/${review.id}`, staff.super.token, { isActive: true })
    expect(active.statusCode).toBe(200)
    expect(JSON.parse(active.body).isActive).toBe(true)
  })

  it('публичная выдача: только готовые, поля согласия не утекают', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/video-reviews?limit=20' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe('public, max-age=60')

    const items = JSON.parse(res.body).items as Array<Record<string, unknown>>
    const mine = items.find((item) => item.id === review.id)
    expect(mine).toBeDefined()
    expect(Object.keys(mine!).sort()).toEqual(['authorName', 'caption', 'id', 'mp4Url', 'posterUrl', 'product', 'webmUrl'])
    expect(mine!.product).toEqual({ slug: PRODUCT_SLUG, name: 'VT Test Product' })
    expect(items.every((item) => item.mp4Url && item.posterUrl)).toBe(true)
  })

  it('удаление MP4 у опубликованного отзыва — 409; WebM снимается', async () => {
    const mp4 = await api('DELETE', `/api/v1/admin/video-reviews/${review.id}/media/mp4`, staff.super.token)
    expect(mp4.statusCode).toBe(409)
    expect(JSON.parse(mp4.body).error.code).toBe('MEDIA_IN_USE')

    const webm = await api('DELETE', `/api/v1/admin/video-reviews/${review.id}/media/webm`, staff.super.token)
    expect(webm.statusCode).toBe(204)
  })

  it('истёкший срок согласия снимает с выдачи; повторная публикация без продления — 409 expired', async () => {
    const expired = await api('PATCH', `/api/v1/admin/video-reviews/${review.id}`, staff.super.token, {
      consentExpiresAt: '2000-01-01',
    })
    expect(expired.statusCode).toBe(200)
    expect(JSON.parse(expired.body).isActive).toBe(false)

    const publicRes = await app.inject({ method: 'GET', url: '/api/v1/video-reviews' })
    const ids = JSON.parse(publicRes.body).items.map((item: { id: string }) => item.id)
    expect(ids).not.toContain(review.id)

    const again = await api('PATCH', `/api/v1/admin/video-reviews/${review.id}`, staff.super.token, { isActive: true })
    expect(again.statusCode).toBe(409)
    expect(JSON.parse(again.body).error.details.missing).toContain('expired')

    await api('PATCH', `/api/v1/admin/video-reviews/${review.id}`, staff.super.token, { consentExpiresAt: null, isActive: true })
  })

  it('отзыв согласия: файлы стираются, документ остаётся, публикация снята', async () => {
    const before = await db.videoReview.findUniqueOrThrow({ where: { id: review.id } })
    const files = [before.mp4Url, before.posterUrl, before.webmUrl].filter((url): url is string => Boolean(url))
    expect(files.length).toBeGreaterThan(0)
    for (const url of files) expect(await exists(fileOf(url))).toBe(true)

    const res = await api('PATCH', `/api/v1/admin/video-reviews/${review.id}`, staff.super.token, { consentRevoked: true })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toMatchObject({ isActive: false, consentConfirmed: false, mp4Url: null, posterUrl: null, webmUrl: null, hasConsentDoc: true })
    expect(body.consentRevokedAt).not.toBeNull()
    for (const url of files) expect(await exists(fileOf(url))).toBe(false)
    expect(await exists(join(videoConsentsDir, before.consentDocPath!))).toBe(true)

    const publicRes = await app.inject({ method: 'GET', url: '/api/v1/video-reviews' })
    expect(JSON.parse(publicRes.body).items.map((item: { id: string }) => item.id)).not.toContain(review.id)
  })

  it('после отзыва загрузка медиа запрещена, публикация — 409 с причиной revoked', async () => {
    const upload409 = await upload(`/api/v1/admin/video-reviews/${review.id}/media/poster`, staff.super.token, fixtures.poster, 'p.jpg', 'image/jpeg')
    expect(upload409.statusCode).toBe(409)
    expect(JSON.parse(upload409.body).error.code).toBe('CONSENT_REVOKED')

    const publish = await api('PATCH', `/api/v1/admin/video-reviews/${review.id}`, staff.super.token, { isActive: true })
    expect(publish.statusCode).toBe(409)
    expect(JSON.parse(publish.body).error.details.missing).toContain('revoked')
  })

  it('новый документ сбрасывает отзыв и подтверждение', async () => {
    const res = await upload(`/api/v1/admin/video-reviews/${review.id}/consent-doc`, staff.super.token, fixtures.pdf, 'consent2.pdf', 'application/pdf')
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toMatchObject({ consentConfirmed: false, isActive: false, consentConfirmedBy: null })
    expect(body.consentRevokedAt).toBeNull()
    const stored = await db.videoReview.findUniqueOrThrow({ where: { id: review.id }, select: { consentDocPath: true } })
    createdConsentDocs.push(stored.consentDocPath!)
  })

  it('CHECK в базе не пускает неготовый отзыв в активные', async () => {
    await expect(db.videoReview.update({ where: { id: spare.id }, data: { isActive: true } })).rejects.toThrow()
  })

  it('документ согласия отдаётся как вложение и не кэшируется', async () => {
    const res = await api('GET', `/api/v1/admin/video-reviews/${review.id}/consent-doc`, staff.super.token)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(res.headers['content-disposition']).toBe(`attachment; filename="consent-${review.id}.pdf"`)
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('порядок: повтор идентификатора — 400, корректный порядок — 204', async () => {
    const dup = await api('PUT', '/api/v1/admin/video-reviews/order', staff.super.token, { ids: [spare.id, spare.id] })
    expect(dup.statusCode).toBe(400)

    const ok = await api('PUT', '/api/v1/admin/video-reviews/order', staff.super.token, { ids: [spare.id, review.id] })
    expect(ok.statusCode).toBe(204)
    const sorted = await db.videoReview.findUniqueOrThrow({ where: { id: review.id }, select: { sortOrder: true } })
    expect(sorted.sortOrder).toBe(1)
  })

  it('URL-поля и служебные поля в теле PATCH не принимаются', async () => {
    const res = await api('PATCH', `/api/v1/admin/video-reviews/${review.id}`, staff.super.token, { mp4Url: '/evil.mp4' })
    expect(res.statusCode).toBe(400)
  })

  it('покупатель не видит админский список (403)', async () => {
    const res = await api('GET', '/api/v1/admin/video-reviews', staff.customer.token)
    expect(res.statusCode).toBe(403)
  })

  it('мягкое удаление: 204, файлы стираются, отзыв пропадает из админки', async () => {
    const res = await api('DELETE', `/api/v1/admin/video-reviews/${spare.id}`, staff.super.token)
    expect(res.statusCode).toBe(204)

    const get = await api('GET', `/api/v1/admin/video-reviews/${spare.id}`, staff.super.token)
    expect(get.statusCode).toBe(404)
    const list = await api('GET', '/api/v1/admin/video-reviews', staff.super.token)
    expect(JSON.parse(list.body).items.map((item: { id: string }) => item.id)).not.toContain(spare.id)
  })
})
