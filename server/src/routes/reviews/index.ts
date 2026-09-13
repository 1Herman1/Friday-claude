import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { saveFile } from '../../lib/storage'

const MAX_FILE_SIZE = 5 * 1024 * 1024

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

const createSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(10, 'Напишите хотя бы пару предложений').max(2000),
  authorName: z.string().trim().min(2).max(60).optional(),
  photo: z.string().max(500).optional(),
  productId: z.string().uuid().optional(),
})

export default async function reviewsRoutes(app: FastifyInstance) {
  // GET / - публичный список одобренных отзывов + свои отзывы если залогинен
  app.get('/', { preHandler: app.authenticateOptional }, async (request, reply) => {
    const parsed = listSchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Некорректные параметры' })

    const { page, limit } = parsed.data
    const uid = (request.user as { userId?: string } | undefined)?.userId

    const where = {
      OR: [
        { status: 'approved' as const },
        ...(uid ? [{ userId: uid }] : []),
      ],
    }

    const [items, total] = await Promise.all([
      app.prisma.review.findMany({
        where,
        select: { id: true, authorName: true, rating: true, text: true, photo: true, status: true, userId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.review.count({ where }),
    ])

    const responseItems = items.map(item => ({
      ...item,
      userId: undefined,
      mine: item.userId === uid,
    }))

    const cacheControl = uid ? 'private, no-store' : 'public, max-age=60'
    reply.header('Cache-Control', cacheControl)

    return { items: responseItems, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) }
  })

  // POST / - создать отзыв
  app.post('/', { preHandler: app.authenticate }, async (request, reply) => {
    const payload = request.user as { userId?: string; type?: string } | undefined

    // Гостьевые токены не могут оставлять отзывы
    if (payload?.type === 'guest') {
      return reply.status(401).send({ error: 'Чтобы оставить отзыв, войдите в аккаунт' })
    }

    const uid = payload?.userId
    if (!uid) return reply.status(401).send({ error: 'Не авторизован' })

    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Некорректные данные' })
    }

    // Анти-спам: не более 3 отзывов в час
    const oneHourAgo = new Date(Date.now() - 3600000)
    const recentCount = await app.prisma.review.count({
      where: { userId: uid, createdAt: { gte: oneHourAgo } },
    })

    if (recentCount >= 3) {
      return reply.status(429).send({ error: 'Слишком много отзывов, попробуйте позже' })
    }

    const data = parsed.data
    const user = await app.prisma.user.findUnique({ where: { id: uid }, select: { name: true } })

    try {
      const review = await app.prisma.review.create({
        data: {
          rating: data.rating,
          text: data.text,
          authorName: data.authorName ?? user?.name ?? 'Аноним',
          photo: data.photo,
          productId: data.productId,
          userId: uid,
          status: 'pending',
        },
        select: { id: true, authorName: true, rating: true, text: true, photo: true, status: true, createdAt: true },
      })

      return reply.status(201).send({ ...review, mine: true })
    } catch (err) {
      throw err
    }
  })

  // DELETE /:id - удалить свой отзыв
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const uid = (request.user as { userId?: string } | undefined)?.userId
      if (!uid) return reply.status(401).send({ error: 'Не авторизован' })

      const deleted = await app.prisma.review.deleteMany({ where: { id: request.params.id, userId: uid } })

      if (deleted.count === 0) {
        return reply.status(404).send({ error: 'Отзыв не найден' })
      }

      return reply.status(204).send()
    }
  )

  // POST /upload - загрузить фото к отзыву
  app.post('/upload', { preHandler: app.authenticate }, async (request, reply) => {
    const payload = request.user as { userId?: string; type?: string } | undefined

    if (payload?.type === 'guest') {
      return reply.status(401).send({ error: 'Гостям нельзя загружать файлы' })
    }

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
