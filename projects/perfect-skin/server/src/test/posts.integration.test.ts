import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import jwt from 'jsonwebtoken'
const { sign } = jwt
import prismaPlugin from '../plugins/prisma.js'
import authenticatePlugin from '../plugins/authenticate.js'
import { ApiError, errorResponse } from '../lib/errors.js'
import { registerCommonSchemas } from '../schemas/common.js'
import publicPostsRoutes from '../routes/posts/index.js'
import adminRoutes from '../routes/admin/index.js'
import { db } from '../lib/db.js'

const DOMAIN = '@ps-posttest.local'
const PREFIX = 'ps-posttest-'

let app: FastifyInstance
const tokens: Record<string, string> = {}

async function build() {
  const instance = Fastify()
  registerCommonSchemas(instance)
  await instance.register(prismaPlugin)
  await instance.register(cookie, { secret: 'test-secret', hook: 'preHandler' })
  await instance.register(rateLimit, { max: 10000, timeWindow: '1 minute' })
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

  await instance.register(publicPostsRoutes, { prefix: '/api/v1' })
  await instance.register(adminRoutes)
  return instance
}

async function makeStaff(role: string) {
  const email = `staff-${role}-${Date.now()}-${Math.random().toString(36).slice(2)}${DOMAIN}`
  const user = await db.user.create({ data: { email, name: `Staff ${role}`, role: role as never } })
  return sign({ userId: user.id, role: user.role, tv: user.tokenVersion }, process.env.JWT_SECRET || 'dev-secret', {
    expiresIn: '1d',
  })
}

const HOUR = 60 * 60 * 1000

async function seedPost(slug: string, data: Partial<Parameters<typeof db.post.create>[0]['data']> = {}) {
  return db.post.create({
    data: {
      slug: `${PREFIX}${slug}`,
      title: `Заголовок ${slug}`,
      body: `Текст ${slug}`,
      audience: 'public',
      publishedAt: new Date(Date.now() - HOUR),
      isActive: true,
      ...data,
    },
  })
}

describe('Posts integration', () => {
  let article: { id: string; slug: string }
  let news: { id: string; slug: string }
  const hidden: Record<string, string> = {}

  beforeAll(async () => {
    app = await build()
    tokens.super = await makeStaff('super_admin')
    tokens.content = await makeStaff('content_manager')
    tokens.customer = await makeStaff('customer')

    article = await seedPost('article', { title: 'Статья для админки', body: 'Полный текст статьи' })
    news = await seedPost('news', {
      kind: 'news',
      isAd: true,
      advertiser: 'ИП Тест',
      erid: 'erid-test-1',
      publishedAt: new Date(Date.now() - HOUR / 2),
    })
    hidden.retail = (await seedPost('retail', { audience: 'retail' })).slug
    hidden.future = (await seedPost('future', { publishedAt: new Date(Date.now() + 24 * HOUR) })).slug
    hidden.deleted = (await seedPost('deleted', { isActive: false, deletedAt: new Date() })).slug
    hidden.inactive = (await seedPost('inactive', { isActive: false })).slug
    hidden.draft = (await seedPost('draft', { publishedAt: null })).slug
  })

  afterAll(async () => {
    await db.post.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await db.user.deleteMany({ where: { email: { endsWith: DOMAIN } } })
    await app.close()
  })

  it('публичный список: только опубликованные публичные материалы, с кэшем и без тела', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/posts?limit=60' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe('public, max-age=60')

    const body = JSON.parse(res.body)
    const slugs = body.items.map((item: { slug: string }) => item.slug)
    expect(slugs).toContain(article.slug)
    expect(slugs).toContain(news.slug)
    for (const slug of Object.values(hidden)) expect(slugs).not.toContain(slug)
    expect(body.items.every((item: object) => !('body' in item))).toBe(true)
  })

  it('фильтр kind отделяет новости от статей', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/posts?kind=news&limit=60' })
    const slugs = JSON.parse(res.body).items.map((item: { slug: string }) => item.slug)
    expect(slugs).toContain(news.slug)
    expect(slugs).not.toContain(article.slug)
  })

  it('фильтр kind=article не отдаёт новости', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/posts?kind=article&limit=60' })
    const items = JSON.parse(res.body).items as Array<{ slug: string; kind: string }>
    expect(items.map((item) => item.slug)).toContain(article.slug)
    expect(items.every((item) => item.kind === 'article')).toBe(true)
  })

  it('в kind=news не попадают отложенные, удалённые и розничные новости', async () => {
    const future = await seedPost('news-future', { kind: 'news', publishedAt: new Date(Date.now() + 24 * HOUR) })
    const deleted = await seedPost('news-deleted', { kind: 'news', isActive: false, deletedAt: new Date() })
    const retail = await seedPost('news-retail', { kind: 'news', audience: 'retail' })
    const res = await app.inject({ method: 'GET', url: '/api/v1/posts?kind=news&limit=60' })
    const body = JSON.parse(res.body)
    const slugs = body.items.map((item: { slug: string }) => item.slug)
    for (const slug of [future.slug, deleted.slug, retail.slug]) expect(slugs).not.toContain(slug)
    expect(body.total).toBe(body.items.length)
  })

  it('элемент публичного списка — только поля карточки, без служебных', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/posts?limit=60' })
    const mine = JSON.parse(res.body).items.find((item: { slug: string }) => item.slug === news.slug)
    expect(Object.keys(mine).sort()).toEqual(
      ['advertiser', 'coverImage', 'createdAt', 'erid', 'excerpt', 'id', 'isAd', 'kind', 'publishedAt', 'slug', 'title'],
    )
  })

  it('неизвестный kind отклоняется', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/posts?kind=video' })
    expect(res.statusCode).toBe(400)
  })

  it('страница статьи отдаёт тип и маркировку рекламы', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/posts/${news.slug}` })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({
      kind: 'news',
      isAd: true,
      advertiser: 'ИП Тест',
      erid: 'erid-test-1',
    })
  })

  it('удалённые, отложенные, розничные, отключённые и черновики не открываются (404)', async () => {
    for (const slug of Object.values(hidden)) {
      const res = await app.inject({ method: 'GET', url: `/api/v1/posts/${slug}` })
      expect(res.statusCode).toBe(404)
      expect(JSON.parse(res.body).error.code).toBe('NOT_FOUND')
    }
  })

  it('админ по id получает заголовок и текст, а не пустой объект', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/posts/${article.id}`,
      headers: { authorization: `Bearer ${tokens.super}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.title).toBe('Статья для админки')
    expect(body.body).toBe('Полный текст статьи')
    expect(body).not.toHaveProperty('deletedAt')
  })

  it('создание статьи с типом новости, рекламой и локальной обложкой', async () => {
    const slug = `${PREFIX}created-${Date.now()}`
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/posts',
      headers: { authorization: `Bearer ${tokens.content}` },
      payload: {
        title: 'Новость с рекламой',
        slug,
        body: 'Текст',
        kind: 'news',
        isAd: true,
        advertiser: 'ИП Рыбко А. А.',
        erid: 'erid-created-1',
        coverImage: '/photos/blog/x.webp',
      },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({
      kind: 'news',
      isAd: true,
      advertiser: 'ИП Рыбко А. А.',
      erid: 'erid-created-1',
      coverImage: '/photos/blog/x.webp',
    })
  })

  it('обложка с произвольной схемой отклоняется', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/posts',
      headers: { authorization: `Bearer ${tokens.content}` },
      payload: { title: 'Плохая', slug: `${PREFIX}bad-cover-${Date.now()}`, body: 'Текст', coverImage: 'javascript:alert(1)' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('слаг удалённой статьи свободен для новой', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/posts',
      headers: { authorization: `Bearer ${tokens.content}` },
      payload: { title: 'Повтор', slug: hidden.deleted, body: 'Новый текст' },
    })
    expect(res.statusCode).toBe(201)
  })

  it('правка удалённой статьи — 404', async () => {
    const deleted = await db.post.findFirstOrThrow({ where: { slug: hidden.deleted, deletedAt: { not: null } } })
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/posts/${deleted.id}`,
      headers: { authorization: `Bearer ${tokens.content}` },
      payload: { title: 'Не должно примениться' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('правка с publishedAt: null переводит статью в черновик, пустые поля принимаются', async () => {
    const post = await seedPost('to-draft')
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/posts/${post.id}`,
      headers: { authorization: `Bearer ${tokens.content}` },
      payload: { publishedAt: null, excerpt: null, coverImage: null, seoTitle: null, seoDescription: null, advertiser: null, erid: null },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).publishedAt).toBeNull()
    expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).publishedAt).toBeNull()
  })

  it('создание с пустыми полями и без даты публикации — черновик', async () => {
    const slug = `${PREFIX}null-fields-${Date.now()}`
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/posts',
      headers: { authorization: `Bearer ${tokens.content}` },
      payload: { title: 'Черновик', slug, body: 'Текст', excerpt: null, publishedAt: null, advertiser: null, erid: null },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body).publishedAt).toBeNull()
  })

  it('админский список по kind=news отдаёт только новости', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/posts?kind=news&limit=100',
      headers: { authorization: `Bearer ${tokens.super}` },
    })
    expect(res.statusCode).toBe(200)
    const items = JSON.parse(res.body).items as Array<{ slug: string; kind: string }>
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((item) => item.kind === 'news')).toBe(true)
    expect(items.map((item) => item.slug)).not.toContain(article.slug)
  })

  it('покупатель не видит админский список (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/posts',
      headers: { authorization: `Bearer ${tokens.customer}` },
    })
    expect(res.statusCode).toBe(403)
  })
})
