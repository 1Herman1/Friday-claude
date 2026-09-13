import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { checkRole } from '../../middleware/check-role'
import { saveFile } from '../../lib/storage'

const MAX_FILE_SIZE = 5 * 1024 * 1024

const reviewSchema = z.object({
  authorName: z.string().trim().min(2).max(60),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(1).max(2000),
  photo: z.string().max(500).nullable().optional(),
  productId: z.string().uuid().nullable().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).default('approved'),
})

const listSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})

const reviewsAdminRoutes: FastifyPluginAsync = async (app) => {
  const guard = { preHandler: [app.authenticate, checkRole(['super_admin', 'products_manager'])] }

  // GET / - список отзывов с фильтрацией
  app.get('/', guard, async (request, reply) => {
    const parsed = listSchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Некорректные параметры' })

    const { status, search, page, limit } = parsed.data

    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { authorName: { contains: search, mode: 'insensitive' as const } },
              { text: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      app.prisma.review.findMany({
        where,
        include: { user: { select: { name: true, email: true } }, product: { select: { name: true, slug: true } } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.review.count({ where }),
    ])

    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) }
  })

  // POST / - создать отзыв вручную
  app.post('/', guard, async (request, reply) => {
    const parsed = reviewSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    }

    try {
      const review = await app.prisma.review.create({
        data: parsed.data,
        include: { user: { select: { name: true, email: true } }, product: { select: { name: true, slug: true } } },
      })
      return reply.status(201).send(review)
    } catch (err) {
      throw err
    }
  })

  // PUT /:id - обновить отзыв
  app.put<{ Params: { id: string } }>('/:id', guard, async (request, reply) => {
    const parsed = reviewSchema.partial().safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    }

    try {
      const review = await app.prisma.review.update({
        where: { id: request.params.id },
        data: parsed.data,
        include: { user: { select: { name: true, email: true } }, product: { select: { name: true, slug: true } } },
      })
      return review
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'P2025') return reply.status(404).send({ error: 'Отзыв не найден' })
      throw err
    }
  })

  // DELETE /:id - удалить отзыв
  app.delete<{ Params: { id: string } }>('/:id', guard, async (request, reply) => {
    try {
      await app.prisma.review.delete({ where: { id: request.params.id } })
      return reply.status(204).send()
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'P2025') return reply.status(404).send({ error: 'Отзыв не найден' })
      throw err
    }
  })

  // POST /upload - загрузить фото для отзыва (админ)
  app.post('/upload', guard, async (request, reply) => {
    const data = await request.file()
    if (!data) {
      return reply.status(400).send({ error: 'Файл не выбран' })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Подойдёт только картинка: JPEG, PNG, WebP или GIF' })
    }

    const buffer = await data.toBuffer()
    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(413).send({ error: 'Файл больше 5 МБ — уменьшите картинку' })
    }

    try {
      const key = await saveFile(buffer, data.mimetype)
      return reply.status(201).send({ key, url: `/api/media/${key}` })
    } catch (err) {
      const notConfigured = err instanceof Error && err.message.includes('not configured')
      return reply.status(notConfigured ? 503 : 500).send({
        error: notConfigured
          ? 'Хранилище картинок не подключено — обратитесь к разработчику'
          : 'Не удалось загрузить картинку, попробуйте ещё раз',
      })
    }
  })
}

export default reviewsAdminRoutes
