import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Разовый перенос дат публикации десяти встроенных статей (свежая — 13.09.2026,
// дальше раз в неделю назад, порядок прежний). Даты в client/src/content/blog
// уже такие, но import-blog.ts дату существующей статьи не трогает — по
// замыслу, чтобы правки владельца в админке не затирались. Поэтому в деплой
// этот скрипт НЕ включён: запускается один раз вручную (run-command.yml).
const DATES: Record<string, string> = {
  'farmina-vs-monge': '2026-09-13',
  'farmina-nd-lineyki': '2026-09-06',
  'monge-lineyki': '2026-08-30',
  'kotyata-ratsion': '2026-08-23',
  'shchenki-ratsion': '2026-08-16',
  'smena-korma-koshke': '2026-08-09',
  'labrador-ratsion': '2026-08-02',
  'original-ili-poddelka': '2026-07-26',
  'koshki-allergiya': '2026-07-19',
  'sukhoy-vlazhny-korm': '2026-07-12',
}

async function main() {
  const apply = process.argv.includes('--apply')

  let changed = 0
  let skipped = 0
  let missing = 0

  for (const [slug, date] of Object.entries(DATES)) {
    const post = await prisma.blogPost.findUnique({
      where: { slug },
      select: { id: true, date: true },
    })

    if (!post) {
      console.log(`${slug}: нет в базе — сначала import-blog.ts`)
      missing++
      continue
    }

    const current = post.date.toISOString().slice(0, 10)
    if (current === date) {
      console.log(`${slug}: уже ${date} — пропуск`)
      skipped++
      continue
    }

    if (apply) {
      await prisma.blogPost.update({
        where: { id: post.id },
        data: { date: new Date(`${date}T00:00:00Z`) },
      })
    }

    console.log(`${slug}: ${current} → ${date}${apply ? '' : ' (будет изменено)'}`)
    changed++
  }

  console.log(
    `\n${apply ? 'Изменено' : 'К изменению'}: ${changed}, пропущено: ${skipped}, не найдено: ${missing}`
  )

  if (!apply && changed > 0) {
    console.log('Это был пробный прогон. Для записи добавьте флаг --apply')
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Ошибка:', err)
  process.exit(1)
})
