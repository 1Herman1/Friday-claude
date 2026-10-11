import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'
import { fixMixedScript } from '../src/lib/text-fixes.js'

// Смешанные алфавиты в названиях товаров («ВEEVENOM» с кириллической В) → один алфавит; slug не меняется
async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  console.log(`Режим: ${apply ? 'ЗАПИСЬ В БАЗУ' : 'сухой прогон'}`)
  const prisma = new PrismaClient()
  try {
    const rows = await prisma.product.findMany({ select: { id: true, slug: true, name: true }, orderBy: { slug: 'asc' } })
    const updates = rows.flatMap((row) => {
      const name = fixMixedScript(row.name)
      return name === row.name ? [] : [{ id: row.id, slug: row.slug, from: row.name, name }]
    })
    for (const u of updates) console.log(`• ${u.slug}: «${u.from}» → «${u.name}»`)
    console.log(`\nИтог: к изменению ${updates.length}`)

    if (!apply) {
      console.log('\nСухой прогон: ничего не записано. Для записи — с флагом --apply.')
      return
    }

    await prisma.$transaction(updates.map((u) => prisma.product.update({ where: { id: u.id }, data: { name: u.name } })))
    console.log(`Обновлено: ${updates.length}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Ошибка:', error instanceof Error ? error.message : error)
  process.exit(1)
})
