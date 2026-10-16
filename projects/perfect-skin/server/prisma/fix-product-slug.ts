import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'

// Опечатка в адресе товара (V вместо B). Старый адрес теперь хранится в Product.previousSlugs (миграция 20261016000001)
const FROM = 'veevenom-serum-syvorotka-pchelinyj-yad'
const TO = 'beevenom-serum-syvorotka-pchelinyj-yad'
const FROM_EMBED = `[[product:${FROM}]]`
const TO_EMBED = `[[product:${TO}]]`

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  console.log(`Режим: ${apply ? 'ЗАПИСЬ В БАЗУ' : 'сухой прогон'}`)
  console.log(`Адрес товара: ${FROM} → ${TO}\n`)
  const prisma = new PrismaClient()
  try {
    const select = { id: true, slug: true, name: true }
    const fromRows = await prisma.product.findMany({ where: { slug: FROM, deletedAt: null }, select })
    const toRows = await prisma.product.findMany({ where: { slug: TO, deletedAt: null }, select })

    // Уже переименован — повторный запуск
    const alreadyDone = fromRows.length === 0 && toRows.length === 1
    if (!alreadyDone) {
      if (fromRows.length !== 1) throw new Error(`ожидался ровно один активный товар ${FROM}, найдено ${fromRows.length}`)
      if (toRows.length > 0) throw new Error(`адрес ${TO} уже занят: ${toRows.map((r) => `«${r.name}» (${r.id})`).join(', ')}`)
    }
    const product = alreadyDone ? null : fromRows[0]
    console.log(product ? `• товар «${product.name}» (${product.id}): slug → ${TO}` : '• товар уже на новом адресе')

    // Включая удалённые статьи: при восстановлении вставка не должна сломаться
    const posts = await prisma.post.findMany({
      where: { body: { contains: FROM_EMBED } },
      select: { id: true, slug: true, body: true },
      orderBy: { slug: 'asc' },
    })
    for (const p of posts) {
      const n = p.body.split(FROM_EMBED).length - 1
      console.log(`• статья ${p.slug}: вставок ${FROM_EMBED} → ${TO_EMBED}: ${n}`)
    }

    // Только отчёт: ссылки работают через алиас, поправить можно в админке
    const offers = await prisma.offer.count({ where: { linkUrl: { contains: FROM }, deletedAt: null } })
    const banners = await prisma.banner.count({ where: { link: { contains: FROM } } })
    if (offers + banners > 0) console.log(`\nСтарый адрес в ссылках (не меняется, работает через алиас): предложений ${offers}, баннеров ${banners}`)

    const total = (product ? 1 : 0) + posts.length
    console.log(`\nИтог: изменений ${total} (товар ${product ? 1 : 0}, статей ${posts.length})`)

    if (!apply) {
      console.log('\nСухой прогон: ничего не записано. Для записи — с флагом --apply.')
      return
    }
    if (total === 0) {
      console.log('Записывать нечего.')
      return
    }

    await prisma.$transaction([
      ...(product ? [prisma.product.update({ where: { id: product.id }, data: { slug: TO } })] : []),
      ...posts.map((p) => prisma.post.update({ where: { id: p.id }, data: { body: p.body.split(FROM_EMBED).join(TO_EMBED) } })),
    ])
    console.log(`Записано: ${total}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Ошибка:', error instanceof Error ? error.message : error)
  process.exit(1)
})
