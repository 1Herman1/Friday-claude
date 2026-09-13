import { PrismaClient } from '@prisma/client'
import { staleGuestWhere } from '../lib/user-type'

// Чистка гостевых аккаунтов без взаимодействий старше N дней.
// По умолчанию только показывает список. Удаляет с флагом --apply.
// Не встроена в деплой автоматически — запускать вручную через run-command.yml

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')
const daysStr = process.argv.find(arg => arg.startsWith('--days='))?.split('=')[1]
const days = daysStr ? parseInt(daysStr) : 30

async function main() {
  const found = await prisma.user.findMany({
    where: staleGuestWhere(days),
    select: {
      id: true,
      createdAt: true,
    },
  })

  if (found.length === 0) {
    console.log(`Гостевых аккаунтов старше ${days} дней без взаимодействий не найдено.`)
    return
  }

  console.log(`Найдено гостевых аккаунтов для удаления: ${found.length}`)
  for (const u of found.slice(0, 10)) {
    console.log(`  • ${u.id}  [создан: ${u.createdAt.toISOString()}]`)
  }
  if (found.length > 10) {
    console.log(`  ... и ещё ${found.length - 10}`)
  }

  if (!apply) {
    console.log('\nЭто предварительный просмотр. Ничего не изменено.')
    console.log('Для удаления запустите ту же команду с флагом --apply')
    return
  }

  // Delete in batches of 500
  const batchSize = 500
  let deleted = 0
  for (let i = 0; i < found.length; i += batchSize) {
    const batch = found.slice(i, i + batchSize).map(u => u.id)
    const result = await prisma.user.deleteMany({
      where: { id: { in: batch } },
    })
    deleted += result.count
  }

  console.log(`\nУдалено: ${deleted}`)
}

main()
  .catch(e => {
    console.error('Ошибка:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
