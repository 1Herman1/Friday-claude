import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { DeliveryMethod } from '@prisma/client'

const subscriptionsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: app.authenticate }, async (request, reply) => {
    const { userId } = request.user

    const subscriptions = await app.prisma.subscription.findMany({
      where: { userId, isActive: true },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        productVariant: {
          select: {
            id: true,
            weight: true,
            price: true,
            stock: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send(subscriptions)
  })

  const updateSubscriptionSchema = z.object({
    isPaused: z.boolean().optional(),
    nextDeliveryAt: z.string().datetime().optional(),
    intervalDays: z.number().int().min(1).optional(),
    productVariantId: z.string().uuid().optional(),
    deliveryMethod: z.enum(['simba_courier', 'cdek', 'yandex', 'pickup']).optional(),
    deliveryAddress: z
      .object({
        city: z.string().min(1),
        street: z.string().min(1),
        house: z.string().min(1),
        apartment: z.string().optional(),
        postalCode: z.string().optional(),
      })
      .optional(),
  })

  app.patch('/:id', { preHandler: app.authenticate }, async (request, reply) => {
    const { userId } = request.user
    const { id } = request.params as { id: string }

    const result = updateSubscriptionSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message })
    }

    try {
      const subscription = await app.prisma.subscription.findUnique({
        where: { id },
        select: { userId: true, productId: true },
      })

      if (!subscription) {
        return reply.status(404).send({ error: 'Подписка не найдена' })
      }

      if (subscription.userId !== userId) {
        return reply.status(403).send({ error: 'Доступ запрещён' })
      }

      // Смена варианта (объём/вкус) — только в пределах того же товара, чтобы
      // productId подписки не разошёлся с реальным productId варианта.
      let productId: string | undefined
      if (result.data.productVariantId) {
        const variant = await app.prisma.productVariant.findUnique({
          where: { id: result.data.productVariantId },
          select: { isActive: true, productId: true },
        })
        if (!variant || !variant.isActive) {
          return reply.status(400).send({ error: 'Выбранный вариант товара недоступен' })
        }
        if (variant.productId !== subscription.productId) {
          return reply.status(400).send({ error: 'Вариант принадлежит другому товару' })
        }
        productId = variant.productId
      }

      const updated = await app.prisma.subscription.update({
        where: { id },
        data: {
          isPaused: result.data.isPaused,
          nextDeliveryAt: result.data.nextDeliveryAt
            ? new Date(result.data.nextDeliveryAt)
            : undefined,
          intervalDays: result.data.intervalDays,
          productVariantId: result.data.productVariantId,
          productId,
          deliveryMethod: result.data.deliveryMethod,
          deliveryAddress: result.data.deliveryAddress ?? undefined,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          productVariant: {
            select: {
              id: true,
              weight: true,
              price: true,
              stock: true,
            },
          },
        },
      })

      return reply.send(updated)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка обновления подписки'
      return reply.status(400).send({ error: message })
    }
  })

  app.post('/:id/skip', { preHandler: app.authenticate }, async (request, reply) => {
    const { userId } = request.user
    const { id } = request.params as { id: string }

    try {
      const subscription = await app.prisma.subscription.findUnique({
        where: { id },
        select: { userId: true, intervalDays: true, nextDeliveryAt: true },
      })

      if (!subscription) {
        return reply.status(404).send({ error: 'Подписка не найдена' })
      }

      if (subscription.userId !== userId) {
        return reply.status(403).send({ error: 'Доступ запрещён' })
      }

      const updated = await app.prisma.subscription.update({
        where: { id },
        data: {
          nextDeliveryAt: new Date(
            subscription.nextDeliveryAt.getTime() + subscription.intervalDays * 24 * 60 * 60 * 1000
          ),
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          productVariant: {
            select: {
              id: true,
              weight: true,
              price: true,
              stock: true,
            },
          },
        },
      })

      return reply.send(updated)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка пропуска доставки'
      return reply.status(400).send({ error: message })
    }
  })

  app.delete('/:id', { preHandler: app.authenticate }, async (request, reply) => {
    const { userId } = request.user
    const { id } = request.params as { id: string }

    try {
      const subscription = await app.prisma.subscription.findUnique({
        where: { id },
        select: { userId: true },
      })

      if (!subscription) {
        return reply.status(404).send({ error: 'Подписка не найдена' })
      }

      if (subscription.userId !== userId) {
        return reply.status(403).send({ error: 'Доступ запрещён' })
      }

      await app.prisma.subscription.update({
        where: { id },
        data: { isActive: false },
      })

      return reply.status(204).send()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка отмены подписки'
      return reply.status(400).send({ error: message })
    }
  })
}

export default subscriptionsRoutes
