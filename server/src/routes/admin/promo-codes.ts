import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { checkRole } from '../../middleware/check-role'
import { promoStatus } from '../../services/promo.service'

const basePromoFields = {
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, 'Код: латиница, цифры, дефис или подчёркивание')
    .transform(s => s.toUpperCase()),
  type: z.enum(['percent', 'fixed']),
  value: z.number().int().positive(),
  minSubtotal: z.number().int().min(0).nullable().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
  comment: z.string().max(500).nullable().optional(),
}

const refinePromo = (data: any, ctx: any) => {
  if (data.type === 'percent' && data.value > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Процент не больше 100',
      path: ['value'],
    })
  }

  if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Дата окончания раньше начала',
      path: ['endsAt'],
    })
  }
}

const promoSchema = z.object(basePromoFields).superRefine(refinePromo)
const promoSchemaPartial = z.object(basePromoFields).partial().superRefine(refinePromo)

const promoCodesAdminRoute: FastifyPluginAsync = async (app) => {
  const guard = { preHandler: [app.authenticate, checkRole(['super_admin', 'orders_manager'])] }

  app.get('/', guard, async (_req, reply) => {
    const promos = await app.prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { orders: true } } },
    })

    const withStatus = promos.map(p => ({
      ...p,
      status: promoStatus(p),
      usageCount: p._count.orders,
      _count: undefined,
    }))

    return reply.send(withStatus)
  })

  app.post('/', guard, async (request, reply) => {
    const parsed = promoSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message })
    }

    try {
      const promo = await app.prisma.promoCode.create({
        data: parsed.data,
      })
      return reply.status(201).send({
        ...promo,
        status: promoStatus(promo),
      })
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2002') {
        return reply.status(409).send({ error: 'Промокод с таким кодом уже есть' })
      }
      throw err
    }
  })

  app.put<{ Params: { id: string } }>('/:id', guard, async (request, reply) => {
    const { id } = request.params
    const parsed = promoSchemaPartial.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message })
    }

    // Merge с существующей записью для проверки дат
    const existing = await app.prisma.promoCode.findUnique({
      where: { id },
      select: { startsAt: true, endsAt: true },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Промокод не найден' })
    }

    const next = {
      startsAt: parsed.data.startsAt ?? existing.startsAt,
      endsAt: parsed.data.endsAt ?? existing.endsAt,
    }

    if (next.startsAt && next.endsAt && next.endsAt <= next.startsAt) {
      return reply.status(400).send({ error: 'Дата окончания раньше начала' })
    }

    if (parsed.data.type === 'percent' && parsed.data.value != null && parsed.data.value > 100) {
      return reply.status(400).send({ error: 'Процент не больше 100' })
    }

    try {
      const promo = await app.prisma.promoCode.update({
        where: { id },
        data: parsed.data,
      })
      return reply.send({
        ...promo,
        status: promoStatus(promo),
      })
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2025') {
        return reply.status(404).send({ error: 'Промокод не найден' })
      }
      throw err
    }
  })

  app.put<{ Params: { id: string } }>('/:id/active', guard, async (request, reply) => {
    const { id } = request.params
    const parsed = z.object({ isActive: z.boolean() }).safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Укажите isActive' })
    }

    try {
      const promo = await app.prisma.promoCode.update({
        where: { id },
        data: { isActive: parsed.data.isActive },
      })
      return reply.send({
        ...promo,
        status: promoStatus(promo),
      })
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2025') {
        return reply.status(404).send({ error: 'Промокод не найден' })
      }
      throw err
    }
  })

  app.delete<{ Params: { id: string } }>('/:id', guard, async (request, reply) => {
    const { id } = request.params
    try {
      await app.prisma.promoCode.delete({ where: { id } })
      return reply.code(204).send()
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2025') {
        return reply.status(404).send({ error: 'Промокод не найден' })
      }
      throw err
    }
  })
}

export default promoCodesAdminRoute
