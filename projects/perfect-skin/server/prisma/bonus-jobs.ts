/**
 * Ночные задачи бонусной программы: сгорание, начисления, обезличивание, сверка.
 *
 * - Без флага --apply — сухой прогон: только подсчёт, ничего не пишется
 * - Пока программа выключена (LoyaltySettings.enabled = false) задачи ничего не делают, кроме сверки
 * - Сверка расхождений > 0 или сбой отдельной записи → код выхода 1: workflow краснеет, GitHub шлёт письмо
 * - Логирует только счётчики и id заказа/счёта при сбое, без ПДн
 */

// Тот же сгенерированный клиент, что у сервера: стандартный @prisma/client пуст
import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'
import {
  reconcileBonusBalances,
  runBonusAccruals,
  runBonusAnonymize,
  runBonusExpirations,
} from '../src/lib/bonus-jobs.js'

const apply = process.argv.includes('--apply')
const prisma = new PrismaClient()

async function main(): Promise<number> {
  const now = new Date()
  console.log(`[bonus-jobs] Starting ${apply ? 'apply' : 'dry run'}...`)

  const expirations = await runBonusExpirations(prisma, now, { apply })
  console.log(`[bonus-jobs] Expirations: accounts ${expirations.accounts}, points ${expirations.expiredPoints}, failed ${expirations.failed}`)

  const accruals = await runBonusAccruals(prisma, now, { apply })
  console.log(`[bonus-jobs] Accruals: due ${accruals.due}, accrued ${accruals.accrued}, skipped ${accruals.skipped}, failed ${accruals.failed}`)

  const anonymized = await runBonusAnonymize(prisma, now, { apply })
  console.log(`[bonus-jobs] Anonymized accounts: ${anonymized.anonymized}`)

  const reconciled = await reconcileBonusBalances(prisma)
  console.log(`[bonus-jobs] Reconciliation: mismatched ${reconciled.mismatched}`)

  console.log(`[bonus-jobs] ${apply ? 'Done' : 'Dry run completed'}`)
  const hasProblems = expirations.failed + accruals.failed + reconciled.mismatched > 0
  return hasProblems ? 1 : 0
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((err: unknown) => {
    console.error('[bonus-jobs] Fatal error', err instanceof Error ? err.name : 'unknown')
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
