import { FastifyInstance } from 'fastify'
import { z } from 'zod'

export const BLOG_CATEGORIES = ['Сравнения кормов', 'Питание', 'Здоровье', 'Кошки', 'Собаки', 'Ветдиеты'] as const

const listSchema = z.object({
  category: z.enum(BLOG_CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
})

const listSelect = {
  id: true, slug: true, title: true, subtitle: true, categories: true, date: true,
  readingMinutes: true, status: true, cover: true, metaTitle: true, metaDescription: true,
} as const

/** Публичный блог: только опубликованные, тело только у одной статьи. */
export default async function blogRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const parsed = listSchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Некорректные параметры' })
    const { category, page, limit } = parsed.data
    const where = { status: 'published' as const, ...(category ? { categories: { has: category } } : {}) }
    const [items, total] = await Promise.all([
      app.prisma.blogPost.findMany({ where, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit, select: listSelect }),
      app.prisma.blogPost.count({ where }),
    ])
    reply.header('Cache-Control', 'public, max-age=60')
    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) }
  })

  app.get<{ Params: { slug: string } }>('/:slug', async (request, reply) => {
    const post = await app.prisma.blogPost.findUnique({ where: { slug: request.params.slug } })
    if (!post || post.status !== 'published') return reply.status(404).send({ error: 'Статья не найдена' })
    reply.header('Cache-Control', 'public, max-age=60')
    return post
  })
}
