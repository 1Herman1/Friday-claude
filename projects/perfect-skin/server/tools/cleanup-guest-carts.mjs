// Уборка брошенных гостевых корзин (контракт 5.2Ж).
// Запуск: node tools/cleanup-guest-carts.mjs  — руками или кроном раз в сутки.
// До покупки сервера крона нет, поэтому скрипт самодостаточный.
import { PrismaClient } from '../../../node_modules/.prisma/ps-client/index.js'

const prisma = new PrismaClient()
const cutoff = new Date(Date.now() - 60 * 24 * 3600 * 1000)

try {
  const { count } = await prisma.cart.deleteMany({
    where: { userId: null, updatedAt: { lt: cutoff } },
  })
  console.log(`удалено гостевых корзин старше 60 дней: ${count}`)
} catch (e) {
  console.error('cleanup-guest-carts failed:', e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
