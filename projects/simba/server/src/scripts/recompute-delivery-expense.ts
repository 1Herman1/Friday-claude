import { PrismaClient } from '@prisma/client'
import { computeDeliveryExpense } from '../services/delivery/delivery-expense.js'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  let since: Date | undefined

  // Парсим флаг --since YYYY-MM-DD
  const sinceIdx = args.indexOf('--since')
  if (sinceIdx !== -1 && args[sinceIdx + 1]) {
    since = new Date(args[sinceIdx + 1])
    if (isNaN(since.getTime())) {
      console.error('Неверная дата, используйте формат YYYY-MM-DD')
      process.exit(1)
    }
  }

  // Находим все заказы, у которых нет расчёта расходов
  const where = {
    deliveryExpense: since ? undefined : null,
    ...(since ? { createdAt: { gte: since } } : {}),
  }

  const total = await prisma.order.count({ where })
  console.log(`Найдено заказов для пересчёта: ${total}`)

  if (total === 0) {
    console.log('Нечего пересчитывать')
    await prisma.$disconnect()
    process.exit(0)
  }

  let processed = 0
  let skipped = 0
  const pageSize = 50

  // Курсор, а не skip: пересчёт убирает заказы из выборки на лету
  // (deliveryExpense перестаёт быть null), и смещение начало бы их перепрыгивать.
  let cursor: string | undefined

  for (;;) {
    const orders = await prisma.order.findMany({
      where,
      select: { id: true, deliveryMethod: true },
      take: pageSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
    })

    if (orders.length === 0) break
    cursor = orders[orders.length - 1].id

    for (const order of orders) {
      try {
        await computeDeliveryExpense(prisma, order.id)
        const result = await prisma.order.findUnique({
          where: { id: order.id },
          select: { deliveryExpense: true, deliveryExpenseNote: true },
        })

        const output = result?.deliveryExpenseNote
          ? `${order.id}, ${order.deliveryMethod}, note: ${result.deliveryExpenseNote}`
          : `${order.id}, ${order.deliveryMethod}, expense: ${result?.deliveryExpense ?? 'unknown'}`

        console.log(output)
        processed++
      } catch (err) {
        console.error(`Ошибка при пересчёте ${order.id}:`, err)
        skipped++
      }

      // Пауза между заказами (лимиты служб)
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }

  console.log(`\nИтого: обработано ${processed}, ошибок ${skipped}`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Критическая ошибка:', err)
  process.exit(1)
})
