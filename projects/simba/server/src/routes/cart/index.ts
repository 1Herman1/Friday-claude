import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  getOrCreateCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  calculateCartTotal,
} from '../../services/cart.service'

function formatCart(cart: Awaited<ReturnType<typeof getOrCreateCart>>) {
  const { subtotal, itemsCount } = calculateCartTotal(cart.items)
  return { ...cart, subtotal, itemsCount }
}

const cartRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: app.authenticate }, async (request, reply) => {
    const { userId } = request.user
    const cart = await getOrCreateCart(app.prisma, userId)
    return reply.send(formatCart(cart))
  })

  const addItemSchema = z.object({
    productVariantId: z.string().uuid(),
    quantity: z.number().int().min(1),
    isSubscription: z.boolean().optional(),
    subscriptionIntervalDays: z.number().int().min(1).optional(),
  })

  app.post('/items', { preHandler: app.authenticate }, async (request, reply) => {
    const result = addItemSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message })
    }

    const { userId } = request.user

    try {
      const cart = await addToCart(
        app.prisma,
        userId,
        result.data.productVariantId,
        result.data.quantity,
        {
          isSubscription: result.data.isSubscription,
          subscriptionIntervalDays: result.data.subscriptionIntervalDays,
        }
      )
      return reply.status(201).send(formatCart(cart))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка добавления товара'
      return reply.status(400).send({ error: message })
    }
  })

  const updateItemSchema = z.object({
    quantity: z.number().int().min(0),
    isSubscription: z.boolean().optional(),
    subscriptionIntervalDays: z.number().int().min(1).optional(),
  })

  app.put('/items/:itemId', { preHandler: app.authenticate }, async (request, reply) => {
    const result = updateItemSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message })
    }

    const { userId } = request.user
    const { itemId } = request.params as { itemId: string }

    try {
      const cart = await updateCartItem(app.prisma, itemId, userId, result.data.quantity, {
        isSubscription: result.data.isSubscription,
        subscriptionIntervalDays: result.data.subscriptionIntervalDays,
      })
      return reply.send(formatCart(cart))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка обновления товара'
      return reply.status(400).send({ error: message })
    }
  })

  app.delete('/items/:itemId', { preHandler: app.authenticate }, async (request, reply) => {
    const { userId } = request.user
    const { itemId } = request.params as { itemId: string }

    try {
      const cart = await removeFromCart(app.prisma, itemId, userId)
      return reply.send(formatCart(cart))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка удаления товара'
      return reply.status(400).send({ error: message })
    }
  })

  app.delete('/', { preHandler: app.authenticate }, async (request, reply) => {
    const { userId } = request.user
    await clearCart(app.prisma, userId)
    return reply.send({ message: 'Корзина очищена' })
  })
}

export default cartRoutes
