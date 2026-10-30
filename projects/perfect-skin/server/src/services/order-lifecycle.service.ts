import { type $Enums, type Prisma } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'
import { bonusService } from './bonus.service.js'

type Tx = Prisma.TransactionClient
type OrderStatus = $Enums.OrderStatus

// Единственный вход для смены статуса и оплаты заказа: админка и вебхук СДЭК
// идут сюда, бонусы не отстанут от статуса ни с одного пути.
export async function changeOrderStatus(
  tx: Tx,
  input: { orderId: string; from: OrderStatus; to: OrderStatus; now: Date }
): Promise<void> {
  if (input.from === input.to) return
  const result = await tx.order.updateMany({
    where: { id: input.orderId, status: input.from },
    data: { status: input.to, ...(input.to === 'delivered' ? { deliveredAt: input.now } : {}) },
  })
  if (result.count === 0) {
    throw new ApiError(409, 'ORDER_STATUS_CONFLICT', 'Статус заказа уже изменён, обновите страницу')
  }
  await bonusService.onOrderStatusChanged(tx, input)
}

export async function markOrderPaid(tx: Tx, input: { orderId: string; now: Date }): Promise<boolean> {
  const result = await tx.order.updateMany({
    where: { id: input.orderId, paymentStatus: { not: 'paid' } },
    data: { paymentStatus: 'paid', paidAt: input.now },
  })
  if (result.count === 1) await bonusService.onOrderPaid(tx, input)
  return result.count === 1
}
