/**
 * Переносит фотографии товаров из МоегоСклада к нам.
 *
 * Ссылки на файлы в МоемСкладе требуют токена: подставить их прямо в витрину
 * нельзя — у покупателя они не откроются. Поэтому файл скачивается, кладётся в
 * наше хранилище картинок и адрес оттуда записывается товару.
 *
 * По умолчанию только показывает, что будет сделано. Записывает — с --apply.
 *
 *   npx tsx --env-file=.env src/scripts/sync-photos.ts
 *   npx tsx --env-file=.env src/scripts/sync-photos.ts --apply --limit 20
 */
import { PrismaClient } from '@prisma/client'
import { fetchProductImages, fullSizeHref, downloadImage } from '../services/moysklad/photos.js'
import { initStorage, saveFile } from '../lib/storage.js'

const prisma = new PrismaClient()

const apply = process.argv.includes('--apply')
const limitArg = process.argv.indexOf('--limit')
const limit = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : undefined

/** Сколько картинок берём на товар. Больше четырёх карточка не показывает. */
const MAX_IMAGES_PER_PRODUCT = 4

async function main() {
  // Скрипт ходит в деплой-шаге: отсутствие токена — предупреждение, а не
  // падение выкатки. Фото просто подъедут, когда токен появится.
  if (!process.env.MOYSKLAD_TOKEN) {
    console.warn('MOYSKLAD_TOKEN не задан — фотографии пропущены, остальное деплою не мешает.')
    process.exit(0)
  }

  if (apply) {
    await initStorage()
  }

  // Только товары без фотографий и с привязкой хотя бы одного варианта к
  // МоемуСкладу: без привязки просить нечего.
  const products = await prisma.product.findMany({
    where: {
      images: { isEmpty: true },
      variants: { some: { moyskladId: { not: null } } },
    },
    select: {
      id: true,
      name: true,
      variants: { where: { moyskladId: { not: null } }, select: { moyskladId: true }, take: 1 },
    },
    take: limit,
  })

  console.log(`Товаров без фотографий с привязкой к МоемуСкладу: ${products.length}`)
  console.log(apply ? 'Режим: запись в базу\n' : 'Режим: только отчёт (для записи добавьте --apply)\n')

  let withPhotos = 0
  let withoutPhotos = 0
  let failed = 0

  for (const product of products) {
    const moyskladId = product.variants[0]?.moyskladId
    if (!moyskladId) continue

    let images
    try {
      images = await fetchProductImages(moyskladId)
    } catch (err) {
      // Причину печатаем: чаще всего это протухший токен или снятые права,
      // и молчаливый пропуск выглядел бы как «фотографий просто нет».
      console.error(`  ✗ ${product.name}: ${err instanceof Error ? err.message : String(err)}`)
      failed += 1
      continue
    }

    const hrefs = images
      .map((image) => ({ href: fullSizeHref(image), filename: image.filename }))
      .filter((item): item is { href: string; filename: string | undefined } => item.href !== null)
      .slice(0, MAX_IMAGES_PER_PRODUCT)

    if (hrefs.length === 0) {
      withoutPhotos += 1
      continue
    }

    withPhotos += 1

    if (!apply) {
      console.log(`  ${product.name} — ${hrefs.length} шт.`)
      continue
    }

    const urls: string[] = []
    for (const { href, filename } of hrefs) {
      try {
        const file = await downloadImage(href, filename)
        if (!file) continue
        const key = await saveFile(file.buffer, file.mimetype)
        urls.push(`/api/media/${key}`)
      } catch (err) {
        console.error(`  ✗ ${product.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    if (urls.length > 0) {
      await prisma.product.update({ where: { id: product.id }, data: { images: urls } })
      console.log(`  ✓ ${product.name} — ${urls.length} шт.`)
    } else {
      failed += 1
    }
  }

  console.log(`\nС фотографиями: ${withPhotos}`)
  console.log(`Без фотографий в МоемСкладе: ${withoutPhotos}`)
  if (failed > 0) console.log(`Не удалось перенести: ${failed}`)
  if (!apply && withPhotos > 0) console.log('\nЧтобы записать: добавьте --apply')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
