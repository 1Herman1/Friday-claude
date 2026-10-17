/**
 * Удаление устаревших документов про-заявок.
 *
 * Логика:
 * - Удаляет файлы у ProDocument, где deletedAt IS NULL и (deleteAfter <= now ИЛИ пользователь удалён)
 * - Отдельно чистит сирот-файлы в PS_PRO_DOCS_DIR, на которые нет записей в БД и старше 1 дня
 * - Без флага --apply — сухой прогон с выводом подсчёта
 * - Заявки консультаций и Отдела заботы (шаг 4): открытая без движения 90 дней закрывается,
 *   персональные данные стираются через 90 дней после последнего изменения; запись остаётся
 * - Логирует без ПДн
 */

// Тот же сгенерированный клиент, что у сервера: стандартный @prisma/client пуст, и чистка падала
import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'
import { readdir, unlink, stat } from 'fs/promises'
import { join } from 'path'
import {
  OPEN_STATUSES,
  planConsultationRetention,
  retentionCutoff,
} from '../src/lib/consultation-retention.js'

const isDryRun = !process.argv.includes('--apply')
const proDocsDir = process.env.PS_PRO_DOCS_DIR || './var/pro-docs'

const prisma = new PrismaClient()

async function main() {
  console.log(`[purge-pro-docs] Starting ${isDryRun ? 'dry run' : 'purge'}...`)

  const now = new Date()

  // Шаг 1: Найти и удалить просроченные документы
  console.log('[purge-pro-docs] Step 1: Finding expired documents...')

  const expiredDocs = await prisma.proDocument.findMany({
    where: {
      deletedAt: null,
      OR: [
        { deleteAfter: { lte: now } },
        { user: { deletedAt: { not: null } } },
      ],
    },
    select: {
      id: true,
      storageKey: true,
    },
  })

  console.log(`[purge-pro-docs] Found ${expiredDocs.length} expired documents`)

  if (!isDryRun) {
    const storageKeys = expiredDocs.map((d) => d.storageKey).filter(Boolean) as string[]

    // Удаляем файлы
    for (const key of storageKeys) {
      try {
        await unlink(join(proDocsDir, key))
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.error(`[purge-pro-docs] Failed to delete file ${key}:`, err)
        }
      }
    }

    // Обновляем БД
    await prisma.proDocument.updateMany({
      where: { id: { in: expiredDocs.map((d) => d.id) } },
      data: {
        storageKey: null,
        deletedAt: now,
      },
    })

    console.log(`[purge-pro-docs] Deleted ${storageKeys.length} expired files`)
  }

  // Шаг 2: Найти и удалить сирот-файлы в FS
  console.log('[purge-pro-docs] Step 2: Finding orphaned files...')

  try {
    const fsFiles = await readdir(proDocsDir)
    console.log(`[purge-pro-docs] Found ${fsFiles.length} files in storage directory`)

    // Найти все файлы в БД
    const dbFiles = await prisma.proDocument.findMany({
      select: { storageKey: true },
    })
    const dbFileSet = new Set(dbFiles.map((d) => d.storageKey).filter(Boolean))

    let orphanedCount = 0
    const orphans: string[] = []

    for (const file of fsFiles) {
      if (!dbFileSet.has(file)) {
        const filePath = join(proDocsDir, file)
        const fileStat = await stat(filePath)
        const fileAge = now.getTime() - fileStat.mtime.getTime()
        const oneDayMs = 24 * 60 * 60 * 1000

        if (fileAge > oneDayMs) {
          orphans.push(file)
          orphanedCount++
        }
      }
    }

    console.log(`[purge-pro-docs] Found ${orphanedCount} orphaned files older than 1 day`)

    if (!isDryRun && orphans.length > 0) {
      for (const file of orphans) {
        try {
          await unlink(join(proDocsDir, file))
        } catch (err) {
          console.error(`[purge-pro-docs] Failed to delete orphaned file ${file}:`, err)
        }
      }
      console.log(`[purge-pro-docs] Deleted ${orphans.length} orphaned files`)
    }
  } catch (err) {
    // Каталог может не существовать
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[purge-pro-docs] Error reading storage directory:', err)
      process.exit(1)
    }
  }

  // Шаг 3: Удалить истекшие токены привязки и просмотра (старше 1 дня)
  console.log('[purge-pro-docs] Step 3: Cleaning up expired Telegram tokens...')

  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const expiredLinkCodes = await prisma.telegramLinkCode.findMany({
    where: { expiresAt: { lt: oneDayAgo } },
    select: { codeHash: true },
  })

  const expiredViewTokens = await prisma.docViewToken.findMany({
    where: { expiresAt: { lt: oneDayAgo } },
    select: { tokenHash: true },
  })

  console.log(`[purge-pro-docs] Found ${expiredLinkCodes.length} expired Telegram link codes`)
  console.log(`[purge-pro-docs] Found ${expiredViewTokens.length} expired doc view tokens`)

  if (!isDryRun) {
    if (expiredLinkCodes.length > 0) {
      await prisma.telegramLinkCode.deleteMany({
        where: { codeHash: { in: expiredLinkCodes.map((c) => c.codeHash) } },
      })
      console.log(`[purge-pro-docs] Deleted ${expiredLinkCodes.length} expired link codes`)
    }

    if (expiredViewTokens.length > 0) {
      await prisma.docViewToken.deleteMany({
        where: { tokenHash: { in: expiredViewTokens.map((t) => t.tokenHash) } },
      })
      console.log(`[purge-pro-docs] Deleted ${expiredViewTokens.length} expired view tokens`)
    }
  }

  // Шаг 4: Заявки консультаций и Отдела заботы (source = 'care').
  // Кандидаты берутся одним снимком до записей: автозакрытие двигает updatedAt,
  // и без снимка заявка, закрытая в этом прогоне, не дошла бы до стирания.
  // Согласия (ConsultationConsent) не трогаем — это подтверждение, что согласие было.
  console.log('[purge-pro-docs] Step 4: Finding consultation requests without movement or past retention...')

  const candidates = await prisma.consultationRequest.findMany({
    where: {
      updatedAt: { lt: retentionCutoff(now) },
      OR: [{ status: { in: OPEN_STATUSES } }, { anonymizedAt: null }],
    },
    select: { id: true, status: true, adminNote: true, updatedAt: true, anonymizedAt: true },
  })
  const plan = planConsultationRetention(candidates, now)

  console.log(`[purge-pro-docs] Found ${plan.autoClose.length} open requests to auto-close`)
  console.log(`[purge-pro-docs] Found ${plan.anonymize.length} requests with personal data to erase`)

  if (!isDryRun && (plan.autoClose.length > 0 || plan.anonymize.length > 0)) {
    await prisma.$transaction(async (tx) => {
      await Promise.all(
        plan.autoClose.map((row) =>
          tx.consultationRequest.updateMany({
            where: { id: row.id, status: { in: OPEN_STATUSES } },
            data: { status: 'cancelled', adminNote: row.adminNote },
          })
        )
      )

      await tx.consultationRequest.updateMany({
        where: { id: { in: plan.anonymize }, anonymizedAt: null },
        data: {
          name: 'Удалено',
          phone: '',
          email: null,
          message: null,
          skinType: null,
          concern: null,
          adminNote: null,
          anonymizedAt: now,
        },
      })
    })
    console.log(`[purge-pro-docs] Auto-closed ${plan.autoClose.length}, erased ${plan.anonymize.length}`)
  }

  console.log(`[purge-pro-docs] ${isDryRun ? 'Dry run' : 'Purge'} completed`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[purge-pro-docs] Fatal error:', err)
  process.exit(1)
})
