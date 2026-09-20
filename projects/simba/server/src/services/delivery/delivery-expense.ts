import { PrismaClient } from '@prisma/client'
import * as cdek from './providers/cdek.js'
import * as yandexPvz from './providers/yandex-pvz.js'
import { getDeliveryOptionExpense } from './delivery-options.js'
import type { DeliveryAddress } from './types.js'

/**
 * Вычисляет и сохраняет расход магазина на доставку заказа.
 * Идемпотентна: повторный вызов пересчитывает значение.
 * Исключения не выбрасываются: сбой службы доставки сохраняется в note.
 */
export async function computeDeliveryExpense(
  prisma: PrismaClient,
  orderId: string
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { productVariant: true },
      },
    },
  })

  if (!order) {
    console.error(`computeDeliveryExpense: заказ ${orderId} не найден`)
    return
  }

  // Суммируем вес всех позиций
  const totalWeightKg = order.items.reduce(
    (sum, item) => sum + item.productVariant.weight * item.quantity,
    0
  )

  let deliveryExpense: number | null = null
  let deliveryExpenseNote: string | null = null

  try {
    switch (order.deliveryMethod) {
      case 'pickup': {
        // Самовывоз не требует расходов
        deliveryExpense = 0
        break
      }

      case 'simba_courier': {
        // Свой курьер: расход из справочника доставки
        const expense = await getDeliveryOptionExpense(prisma, 'simba_courier')
        if (expense !== null) {
          deliveryExpense = expense
        } else {
          deliveryExpenseNote = 'Опция доставки simba_courier не найдена'
        }
        break
      }

      case 'cdek':
      case 'yandex': {
        // Расход считает сама служба — по выбранному пункту и весу корзины.
        if (!order.deliveryPoint || !order.deliveryAddress) {
          deliveryExpenseNote = 'Пункт выдачи или адрес не указаны'
          break
        }
        const address: DeliveryAddress = {
          city: (order.deliveryAddress as { city?: string }).city ?? '',
          pickupPoint: order.deliveryPoint as unknown as DeliveryAddress['pickupPoint'],
        }
        const provider = order.deliveryMethod === 'cdek' ? cdek : yandexPvz
        const quote = await provider.getPickupPointQuote(address, { weightKg: totalWeightKg })
        if (quote.available) {
          deliveryExpense = quote.price
        } else {
          deliveryExpenseNote = quote.error ?? 'Служба доставки недоступна'
        }
        break
      }

      case 'ozon': {
        deliveryExpenseNote = 'Расчёт Ozon не подключён'
        break
      }

      // post и dostavista в заказах больше не создаются, но значения остались в enum
      case 'post':
      case 'dostavista': {
        deliveryExpenseNote = `Способ доставки ${order.deliveryMethod} не поддерживается`
        break
      }

      default: {
        const exhaustive: never = order.deliveryMethod
        throw new Error(`Неизвестный способ доставки: ${exhaustive}`)
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    deliveryExpenseNote = `Ошибка при расчёте расходов: ${message}`
    console.error(`computeDeliveryExpense(${orderId}):`, err)
  }

  // Сохраняем результат
  await prisma.order.update({
    where: { id: orderId },
    data: {
      deliveryExpense,
      deliveryExpenseNote,
    },
  })
}
