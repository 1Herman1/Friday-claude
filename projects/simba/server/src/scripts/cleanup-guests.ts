import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { guestCleanupDaysSchema, runGuestCleanupTracked } from '../services/guest-cleanup.service'

const prisma = new PrismaClient()

class InvalidDaysError extends Error {
  constructor(public input: string) {
    super(`Недопустимое значение для --days: ${input}. Ожидается целое число от 7 до 365.`)
  }
}

export function parseDaysArg(input: string): number {
  // Number() безопаснее parseInt: Number('30abc') даёт NaN вместо 30
  const num = Number(input)
  if (!Number.isInteger(num)) {
    throw new InvalidDaysError(input)
  }
  try {
    return guestCleanupDaysSchema.parse(num)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new InvalidDaysError(input)
    }
    throw error
  }
}

async function main() {
  const now = new Date().toISOString()
  const apply = process.argv.includes('--apply')
  const daysStr = process.argv.find(arg => arg.startsWith('--days='))?.split('=')[1]

  let days: number
  try {
    days = daysStr ? parseDaysArg(daysStr) : 30
  } catch (error) {
    if (error instanceof InvalidDaysError) {
      console.error(`${now} ${error.message}`)
      process.exit(2)
    }
    throw error
  }

  try {
    const dryRun = !apply
    console.log(`${now} Чистка гостевых сессий старше ${days} дней${dryRun ? ' (предпросмотр)' : ''}`)

    // SYNC_TRIGGER=cron ставит crontab (deploy/DEPLOY.md): иначе ночной прогон
    // покажется в админке как запущенный вручную.
    const trigger = process.env.SYNC_TRIGGER === 'cron' ? 'cron' : 'manual'
    const report = await runGuestCleanupTracked(prisma, days, dryRun, undefined, trigger)

    if (report.candidates === 0) {
      console.log(`${now} Кандидатов не найдено.`)
      process.exit(0)
    }

    console.log(`${now} Найдено кандидатов: ${report.candidates}`)
    console.log(`${now} Обработано: ${report.taken}${report.hasMore ? ' (взят максимум за прогон, остальные — следующей ночью)' : ''}`)

    if (report.sample.length > 0) {
      console.log(`${now} Примеры (первые ${report.sample.length}):`)
      for (const item of report.sample) {
        console.log(`${now}   • ${item.id} [последняя активность: ${item.lastActivity}]`)
      }
    }

    if (!apply) {
      console.log(`${now} Это предварительный просмотр. Ничего не изменено.`)
      console.log(`${now} Для удаления запустите команду с флагом --apply`)
      process.exit(0)
    }

    console.log(`${now} Удалено: ${report.deleted}`)
    if (report.consentsCleared > 0) {
      console.log(`${now} Обезличено согласий: ${report.consentsCleared}`)
    }

    if (report.skippedChunks > 0) {
      console.log(`${now} Пропущено батчей: ${report.skippedChunks} (заказы прошли во время обработки)`)
    }

    if (report.hasMore) {
      console.log(`${now} Есть ещё кандидаты (следующий прогон поймёт остальных)`)
    }

    if (report.failedChunks > 0 || report.errors.length > 0) {
      console.error(`${now} Чанков с ошибкой: ${report.failedChunks}`)
      for (const err of report.errors) {
        console.error(`${now}   • ${err.id}: ${err.error}`)
      }
      // Ненулевой код: cron судит о прогоне по нему, а не по содержимому лога.
      process.exit(4)
    }

    process.exit(0)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`${now} Ошибка: ${msg}`)
    if (error instanceof Error && error.stack) {
      console.error(`${now} ${error.stack}`)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Запуск только как скрипт: импорт ради parseDaysArg не должен поднимать Prisma,
// занимать слот прогона и звать process.exit (это убивает воркер тестов).
// Проект собирается в CommonJS, поэтому сверяем require.main, а не import.meta.
if (require.main === module) {
  main()
}
