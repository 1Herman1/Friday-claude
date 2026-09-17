import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  updateOrderStatus,
  markOrderPaid,
  markOrderRefunded,
  OrderCancelledError,
} from '../../services/order.service'
import { computeDeliveryExpense } from '../../services/delivery/delivery-expense.js'
import { createReturnDocument } from '../../services/moysklad/returns'

/** Роль проверяем сами, живость токена — плагином `app.authenticate`:
    блокировка сотрудника и гашение сессий должны действовать и здесь. */
async function requireOrdersRole(request: FastifyRequest, reply: FastifyReply) {
  const { role } = request.user
  if (role !== 'super_admin' && role !== 'orders_manager') {
    return reply.status(403).send({ error: 'Недостаточно прав' })
  }
}

const updateStatusSchema = z.object({
  status: z.enum(['confirmed', 'in_transit', 'delivered', 'cancelled']),
})

const updatePaymentSchema = z.object({
  paymentStatus: z.enum(['paid', 'failed', 'refunded']),
})

const orderAdminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: [app.authenticate, requireOrdersRole] }, async (request, reply) => {
    const query = request.query as {
      status?: string
      page?: string
      limit?: string
      userId?: string
      dateFrom?: string
      dateTo?: string
    }

    const page = Math.max(1, parseInt(query.page ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20')))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    if (query.status) where.status = query.status
    if (query.userId) where.userId = query.userId
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      }
    }

    const [items, total] = await Promise.all([
      app.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true, user: { select: { id: true, name: true, email: true, phone: true } } },
      }),
      app.prisma.order.count({ where }),
    ])

    return reply.send({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  })

  app.get('/:id', { preHandler: [app.authenticate, requireOrdersRole] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const order = await app.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    })

    if (!order) {
      return reply.status(404).send({ error: 'Заказ не найден' })
    }

    return reply.send(order)
  })

  app.put('/:id/status', { preHandler: [app.authenticate, requireOrdersRole] }, async (request, reply) => {
    const result = updateStatusSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message })
    }

    const { id } = request.params as { id: string }

    try {
      const order = await updateOrderStatus(app.prisma, id, result.data.status)

      // Если отменили заказ и товар не был возвращён, вызовём МойСклад
      if (result.data.status === 'cancelled' && !order.msReturnId && !order.stockRestored) {
        // Получаем полную информацию о позициях с вариантами
        const fullOrder = await app.prisma.order.findUnique({
          where: { id },
          include: {
            items: {
              include: {
                productVariant: {
                  select: { moyskladId: true, sku: true },
                },
              },
            },
          },
        })

        if (fullOrder?.items) {
          const positions = fullOrder.items.map((item) => ({
            moyskladId: item.productVariant?.moyskladId ?? null,
            sku: item.productVariant?.sku ?? null,
            name: item.productName,
            quantity: item.quantity,
            price: item.price,
          }))

          // Вызываем МойСклад, но не блокируем ответ на его результате
          createReturnDocument({ orderId: id, positions })
            .then((msResult) => {
              if (msResult.ok) {
                // Обновляем msReturnId в заказе
                app.prisma.order.update({
                  where: { id },
                  data: { msReturnId: msResult.msId },
                }).catch((err) => {
                  app.log.error({ err }, 'Ошибка при обновлении msReturnId')
                })
              } else {
                app.log.warn(
                  { reason: msResult.reason },
                  'Не удалось создать документ возврата в МойСклад'
                )
              }
            })
            .catch((err) => {
              app.log.error({ err }, 'Ошибка при вызове МойСклад')
            })
        }
      }

      return reply.send(order)
    } catch (err) {
      // Конфликт состояния, а не плохие данные — иначе админ читает «ошибка
      // обновления статуса» и не понимает, что заказ уже отменён.
      if (err instanceof OrderCancelledError) {
        return reply.status(409).send({ error: err.message, code: 'ORDER_CANCELLED' })
      }
      const message = err instanceof Error ? err.message : 'Ошибка обновления статуса'
      return reply.status(400).send({ error: message })
    }
  })

  app.put('/:id/payment', { preHandler: [app.authenticate, requireOrdersRole] }, async (request, reply) => {
    const result = updatePaymentSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message })
    }

    const { id } = request.params as { id: string }

    try {
      let order
      switch (result.data.paymentStatus) {
        case 'paid':
          order = await markOrderPaid(app.prisma, id)
          break
        case 'refunded':
          order = await markOrderRefunded(app.prisma, id)
          break
        case 'failed':
          // Only update status, no bonus adjustments
          order = await app.prisma.order.update({
            where: { id },
            data: { paymentStatus: 'failed' },
          })
          break
      }
      return reply.send(order)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка обновления платежа'
      return reply.status(400).send({ error: message })
    }
  })

  app.post('/:id/delivery-expense/recompute', { preHandler: [app.authenticate, requireOrdersRole] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    // Проверяем, что заказ существует
    const order = await app.prisma.order.findUnique({
      where: { id },
      select: { id: true, deliveryExpense: true, deliveryExpenseNote: true },
    })

    if (!order) {
      return reply.status(404).send({ error: 'Заказ не найден' })
    }

    try {
      // Пересчитываем расходы
      await computeDeliveryExpense(app.prisma, id)

      // Возвращаем обновлённые поля
      const updated = await app.prisma.order.findUniqueOrThrow({
        where: { id },
        select: { deliveryExpense: true, deliveryExpenseNote: true },
      })

      return reply.send(updated)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка пересчёта расходов'
      return reply.status(400).send({ error: message })
    }
  })
}

export default orderAdminRoutes
