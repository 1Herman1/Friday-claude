import { Prisma, BonusTxType } from '@prisma/client'
import { calculateBonusLevel } from '@simba/shared'

export class InsufficientBonusError extends Error {
  constructor() {
    super('Недостаточно бонусов для списания')
  }
}

export interface ApplyBonusChangeInput {
  userId: string
  amount: number
  type: BonusTxType
  orderId?: string
  comment?: string
  requireSufficient?: boolean
}

interface ApplyBonusChangeOutput {
  balanceAfter: number
  bonusLevel: 'newcomer' | 'active' | 'premium'
}

/**
 * Единственная точка изменения баланса бонусов.
 * Создаёт запись в BonusTransaction и обновляет bonusLevel.
 * Должна вызваться только внутри транзакции.
 */
export async function applyBonusChange(
  tx: Prisma.TransactionClient,
  input: ApplyBonusChangeInput
): Promise<ApplyBonusChangeOutput> {
  const { userId, amount, type, orderId, comment, requireSufficient } = input

  type BalanceRow = { bonusPoints: number; bonusLevel: 'newcomer' | 'active' | 'premium' }
  let user: BalanceRow

  if (requireSufficient && amount < 0) {
    // Условное списание: защита от гонки
    const updated = await tx.user.updateMany({
      where: { id: userId, bonusPoints: { gte: Math.abs(amount) } },
      data: { bonusPoints: { increment: amount } },
    })

    if (updated.count === 0) {
      throw new InsufficientBonusError()
    }

    user = await tx.user.findUniqueOrThrow({ where: { id: userId } })
  } else {
    // Обычное изменение (начисление, возврат, admin adjust)
    user = await tx.user.update({
      where: { id: userId },
      data: { bonusPoints: { increment: amount } },
    })
  }

  const balanceAfter = user.bonusPoints
  const newLevel = calculateBonusLevel(balanceAfter)

  // Обновить уровень, если он изменился
  if (newLevel !== user.bonusLevel) {
    await tx.user.update({
      where: { id: userId },
      data: { bonusLevel: newLevel },
    })
  }

  // Записать операцию в журнал
  await tx.bonusTransaction.create({
    data: {
      userId,
      orderId,
      type,
      amount,
      balanceAfter,
      comment,
    },
  })

  return {
    balanceAfter,
    bonusLevel: newLevel,
  }
}


/**
 * Вспомогательная функция для расчёта составляющих отмены заказа.
 * Возвращает две отдельные суммы: возврат списанного и снятие начисленного.
 */
export function settleOnCancelComponents(
  order: {
    bonusUsed: number
    bonusEarned: number
    bonusEarnedCredited: boolean
    bonusUsedRefunded: boolean
  },
  currentBalance: number
): { bonusToRefund: number; bonusToDeduct: number } {
  let bonusToRefund = 0
  let bonusToDeduct = 0

  // Вернуть списанные бонусы, если ещё не вернули
  if (!order.bonusUsedRefunded && order.bonusUsed > 0) {
    bonusToRefund = order.bonusUsed
  }

  // Снять начисленные бонусы, если они были начислены
  if (order.bonusEarnedCredited && order.bonusEarned > 0) {
    // Снимаем максимум, что есть на балансе после возврата
    bonusToDeduct = Math.max(0, Math.min(order.bonusEarned, currentBalance + bonusToRefund))
  }

  return { bonusToRefund, bonusToDeduct }
}
