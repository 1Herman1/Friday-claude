import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { checkRole } from '../../middleware/check-role'
import { saveFile } from '../../lib/storage'

const schema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  logo: z.string().max(500).nullable().optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Цвет в формате #RRGGBB').nullable().optional(),
  logoFit: z.enum(['wide', 'mid', 'mark']).nullable().optional(),
  description: z.string().optional(),
})

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const brandsAdminRoute: FastifyPluginAsync = async (app) => {
  const guard = { preHandler: [app.authenticate, checkRole(['super_admin', 'products_manager'])] }

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

  app.get('/', guard, async (_req, reply) => {
    const brands = await app.prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    })
    return reply.send(brands)
  })

  app.post('/', guard, async (request, reply) => {
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message })
    const brand = await app.prisma.brand.create({ data: parsed.data })
    return reply.status(201).send(brand)
  })

  app.put<{ Params: { id: string } }>('/:id', guard, async (request, reply) => {
    const parsed = schema.partial().safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message })
    const { id } = request.params
    try {
      const brand = await app.prisma.brand.update({ where: { id }, data: parsed.data })
      return reply.send(brand)
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2025') {
        return reply.status(404).send({ error: 'Бренд не найден' })
      }
      if ((err as { code?: string })?.code === 'P2002') {
        return reply.status(409).send({ error: 'Бренд с таким slug уже есть' })
      }
      throw err
    }
  })

  app.delete<{ Params: { id: string } }>('/:id', guard, async (request, reply) => {
    const { id } = request.params
    try {
      await app.prisma.brand.delete({ where: { id } })
      return reply.send({ success: true })
    } catch (err: any) {
      if (err?.code === 'P2003' || err?.code === 'P2014') {
        return reply.status(409).send({
          error: 'Невозможно удалить бренд: у него есть товары. Сначала переназначьте или удалите товары.',
        })
      }
      throw err
    }
  })
}

export default brandsAdminRoute
