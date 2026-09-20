import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { checkRole } from '../../middleware/check-role'

const KNOWN_KEYS = ['simba_courier', 'cdek_pvz', 'yandex_pvz', 'ozon_pvz', 'pickup'] as const

const updateSchema = z.object({
  title: z.string().min(1).max(60).optional(),
  subtitle: z.string().max(120).nullable().optional(),
  price: z.number().int().min(0).optional(),
  expense: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  etaMin: z.number().int().min(0).max(60).nullable().optional(),
  etaMax: z.number().int().min(0).max(60).nullable().optional(),
  freeFrom: z.number().int().min(0).nullable().optional(),
}).refine((d) => d.etaMin == null || d.etaMax == null || d.etaMax >= d.etaMin, {
  message: 'etaMax должен быть не меньше etaMin',
  path: ['etaMax'],
})

const deliveryOptionsAdminRoute: FastifyPluginAsync = async (app) => {
  const guard = { preHandler: [app.authenticate, checkRole(['super_admin', 'products_manager'])] }

  // Получить все варианты доставки (включая выключенные)
  app.get('/', guard, async (_req, reply) => {
    const options = await app.prisma.deliveryOption.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return reply.send(options)
  })

  // Обновить вариант доставки
  app.patch<{ Params: { key: string } }>('/:key', guard, async (request, reply) => {
    const { key } = request.params

    // Ключ должен быть из известных
    if (!KNOWN_KEYS.includes(key as any)) {
      return reply.status(404).send({ error: 'Неизвестный способ доставки' })
    }

    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message })
    }

    try {
      const option = await app.prisma.deliveryOption.update({
        where: { key },
        data: parsed.data,
      })
      return reply.send(option)
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2025') {
        return reply.status(404).send({ error: 'Способ доставки не найден' })
      }
      throw err
    }
  })
}

export default deliveryOptionsAdminRoute
