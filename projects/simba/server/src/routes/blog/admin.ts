import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { checkRole } from '../../middleware/check-role'
import { saveFile } from '../../lib/storage'
import { BLOG_CATEGORIES } from './index'

const MAX_FILE_SIZE = 5 * 1024 * 1024

const postSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Слаг: латиница, цифры и дефис').min(1).max(120),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).nullable().optional(),
  body: z.string().max(200_000).default(''),
  categories: z.array(z.enum(BLOG_CATEGORIES)).default([]),
  date: z.coerce.date(),
  readingMinutes: z.number().int().min(0).optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  cover: z.string().max(500).nullable().optional(),
  metaTitle: z.string().max(200).nullable().optional(),
  metaDescription: z.string().max(500).nullable().optional(),
})

const listSchema = z.object({
  status: z.enum(['draft', 'published']).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})

/** Минуты чтения считаем сами, если админ не указал: ~180 слов в минуту. */
function readingMinutesOf(body: string, given?: number): number {
  if (given && given > 0) return given
  const words = body.trim().split(/\s+/).filter(Boolean).length
  return words === 0 ? 0 : Math.max(1, Math.ceil(words / 180))
}

const blogAdminRoutes: FastifyPluginAsync = async (app) => {
  const guard = { preHandler: [app.authenticate, checkRole(['super_admin', 'products_manager'])] }

  app.get('/', guard, async (request, reply) => {
    const parsed = listSchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Некорректные параметры' })
    const { status, search, page, limit } = parsed.data
    const where = {
      ...(status ? { status } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' as const } }, { slug: { contains: search } }] } : {}),
    }
    const [items, total] = await Promise.all([
      app.prisma.blogPost.findMany({
        where, orderBy: [{ status: 'asc' }, { date: 'desc' }], skip: (page - 1) * limit, take: limit,
        select: { id: true, slug: true, title: true, subtitle: true, categories: true, date: true, readingMinutes: true, status: true, cover: true, updatedAt: true },
      }),
      app.prisma.blogPost.count({ where }),
    ])
    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) }
  })

  app.get<{ Params: { id: string } }>('/:id', guard, async (request, reply) => {
    const post = await app.prisma.blogPost.findUnique({ where: { id: request.params.id } })
    if (!post) return reply.status(404).send({ error: 'Статья не найдена' })
    return post
  })

  app.post('/', guard, async (request, reply) => {
    const parsed = postSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    const d = parsed.data
    try {
      const post = await app.prisma.blogPost.create({
        data: { ...d, readingMinutes: readingMinutesOf(d.body, d.readingMinutes) },
      })
      return reply.status(201).send(post)
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') return reply.status(409).send({ error: 'Статья с таким слагом уже есть' })
      throw err
    }
  })

  app.put<{ Params: { id: string } }>('/:id', guard, async (request, reply) => {
    const parsed = postSchema.partial().safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    const d = parsed.data
    try {
      const current = await app.prisma.blogPost.findUnique({ where: { id: request.params.id }, select: { body: true } })
      if (!current) return reply.status(404).send({ error: 'Статья не найдена' })
      const body = d.body ?? current.body
      const post = await app.prisma.blogPost.update({
        where: { id: request.params.id },
        data: { ...d, readingMinutes: readingMinutesOf(body, d.readingMinutes) },
      })
      return post
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'P2002') return reply.status(409).send({ error: 'Статья с таким слагом уже есть' })
      if (code === 'P2025') return reply.status(404).send({ error: 'Статья не найдена' })
      throw err
    }
  })

  app.delete<{ Params: { id: string } }>('/:id', guard, async (request, reply) => {
    try {
      await app.prisma.blogPost.delete({ where: { id: request.params.id } })
      return reply.status(204).send()
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') return reply.status(404).send({ error: 'Статья не найдена' })
      throw err
    }
  })

  // Обложка: та же логика, что у баннеров.
  app.post('/upload', guard, async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'Файл не выбран' })
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(data.mimetype)) return reply.status(400).send({ error: 'Подойдёт только картинка: JPEG, PNG, WebP или GIF' })
    const buffer = await data.toBuffer()
    if (buffer.length > MAX_FILE_SIZE) return reply.status(413).send({ error: 'Файл больше 5 МБ — уменьшите картинку' })
    try {
      const key = await saveFile(buffer, data.mimetype)
      return reply.status(201).send({ key, url: `/api/media/${key}` })
    } catch (err) {
      const notConfigured = err instanceof Error && err.message.includes('not configured')
      return reply.status(notConfigured ? 503 : 500).send({
        error: notConfigured ? 'Хранилище картинок не подключено — обратитесь к разработчику' : 'Не удалось загрузить картинку, попробуйте ещё раз',
      })
    }
  })
}

export default blogAdminRoutes
