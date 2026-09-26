/**
 * Удаление устаревших документов про-заявок.
 *
 * Логика:
 * - Удаляет файлы у ProDocument, где deletedAt IS NULL и (deleteAfter <= now ИЛИ пользователь удалён)
 * - Отдельно чистит сирот-файлы в PS_PRO_DOCS_DIR, на которые нет записей в БД и старше 1 дня
 * - Без флага --apply — сухой прогон с выводом подсчёта
 * - Логирует без ПДн
 */

import { PrismaClient } from '@prisma/client'
import { readdir, unlink, stat } from 'fs/promises'
import { join } from 'path'

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

  console.log(`[purge-pro-docs] ${isDryRun ? 'Dry run' : 'Purge'} completed`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[purge-pro-docs] Fatal error:', err)
  process.exit(1)
})
