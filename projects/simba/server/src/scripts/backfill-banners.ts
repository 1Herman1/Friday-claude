import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Четыре баннера владельца для карусели главной. Файлы он загрузил в репозиторий
// (client/public/banners/{desktop,mobile}) и они давно на боевом, но строки
// Banner создавал только dev-сид — боевая база оставалась пустой, и карусель
// на главной не рендерилась вовсе. Тексты и ссылки — ровно те, что в
// prisma/seed.ts; текст нарисован на самой картинке, поэтому showText: false.
const HOME_BANNERS = [
  {
    id: 'banner-bonus-registration',
    title: '300 бонусов в подарок за регистрацию',
    subtitle: '1 бонус = 1 рубль. Оплачивайте бонусами до 50% следующего заказа',
    slug: 'bonus-registration',
    link: '/auth',
  },
  {
    id: 'banner-cashback-5',
    title: 'Возвращаем 5% бонусами с каждого заказа',
    subtitle: 'Бонусы действуют 6 месяцев',
    slug: 'cashback-5',
    link: '/bonuses',
  },
  {
    id: 'banner-free-delivery-pvz',
    title: 'Бесплатная доставка до пункта выдачи на любой заказ',
    subtitle: 'Яндекс Маркет и СДЭК',
    slug: 'free-delivery-pvz',
    link: '/delivery',
  },
  {
    id: 'banner-pickup-free',
    title: 'Заберите заказ уже через час самовывозом бесплатно',
    subtitle: 'Доставим по Москве за 1 день',
    slug: 'pickup-free',
    link: '/delivery',
  },
]

async function main() {
  const apply = process.argv.includes('--apply')

  let created = 0
  let skipped = 0

  for (const [index, b] of HOME_BANNERS.entries()) {
    const existing = await prisma.banner.findUnique({ where: { id: b.id }, select: { id: true } })

    // Только создание: запись, которую владелец уже правил в админке,
    // скрипт не перетирает — в отличие от dev-сида, где update = create.
    if (existing) {
      console.log(`${b.id}: уже есть — пропуск`)
      skipped++
      continue
    }

    if (apply) {
      await prisma.banner.create({
        data: {
          id: b.id,
          title: b.title,
          subtitle: b.subtitle,
          image: `/banners/desktop/${b.slug}.webp`,
          imageMobile: `/banners/mobile/${b.slug}.webp`,
          showText: false,
          link: b.link,
          page: 'home',
          position: 'main_slider',
          sortOrder: index + 1,
          isActive: true,
        },
      })
      console.log(`${b.id}: создан`)
    } else {
      console.log(`${b.id}: будет создан`)
    }
    created++
  }

  // Демонстрационные слайды из самого первого сида — на боевом их быть не должно.
  const stale = await prisma.banner.findMany({
    where: { id: { in: ['banner-1-home', 'banner-2-home', 'banner-3-home'] } },
    select: { id: true },
  })
  if (stale.length > 0) {
    if (apply) {
      await prisma.banner.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } })
      console.log(`Удалено демонстрационных слайдов: ${stale.length}`)
    } else {
      console.log(`Будет удалено демонстрационных слайдов: ${stale.length}`)
    }
  }

  console.log(`\n${apply ? 'Создано' : 'К созданию'}: ${created}, пропущено: ${skipped}`)
  if (!apply && created > 0) {
    console.log('Это был пробный прогон. Для записи добавьте флаг --apply')
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Ошибка:', err)
  process.exit(1)
})
