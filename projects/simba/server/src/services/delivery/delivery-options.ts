import type { PrismaClient } from '@prisma/client'
import { deliveryKindOf, type DeliveryOptionInfo, type DeliveryOptionKey } from '@simba/shared'

const KNOWN_KEYS: DeliveryOptionKey[] = ['simba_courier', 'cdek_pvz', 'yandex_pvz', 'ozon_pvz', 'pickup']

function isKnownKey(key: string): key is DeliveryOptionKey {
  return (KNOWN_KEYS as string[]).includes(key)
}

/**
 * Прайс-лист доставки из базы — единственный источник цен для чекаута,
 * проверки заказа и страницы «Доставка». Строки с незнакомым ключом (например,
 * добавленные руками в базу) молча пропускаются: витрина их отобразить не умеет.
 */
export async function listDeliveryOptions(
  prisma: PrismaClient,
  opts: { includeInactive?: boolean } = {}
): Promise<DeliveryOptionInfo[]> {
  const rows = await prisma.deliveryOption.findMany({
    where: opts.includeInactive ? undefined : { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
  return rows.flatMap((row) =>
    isKnownKey(row.key)
      ? [{ key: row.key, kind: deliveryKindOf(row.key), title: row.title, subtitle: row.subtitle, price: row.price, etaMin: row.etaMin, etaMax: row.etaMax, freeFrom: row.freeFrom }]
      : []
  )
}

export async function getDeliveryOption(
  prisma: PrismaClient,
  key: DeliveryOptionKey
): Promise<DeliveryOptionInfo | null> {
  const row = await prisma.deliveryOption.findUnique({ where: { key } })
  if (!row || !row.isActive) return null
  return { key, kind: deliveryKindOf(key), title: row.title, subtitle: row.subtitle, price: row.price, etaMin: row.etaMin, etaMax: row.etaMax, freeFrom: row.freeFrom }
}

/**
 * Получает расход магазина на указанный способ доставки.
 * Нужен для способов без API (simba_courier, pickup).
 */
export async function getDeliveryOptionExpense(
  prisma: PrismaClient,
  key: DeliveryOptionKey
): Promise<number | null> {
  const row = await prisma.deliveryOption.findUnique({ where: { key } })
  if (!row || !row.isActive) return null
  return row.expense
}
