import type { PublicPostListItem, PublicVideoReview } from '@/lib/admin-api'

const DAY_MS = 86_400_000
const ago = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString()
const NO_AD = { isAd: false, advertiser: null, erid: null }

export const DEMO_ARTICLES: PublicPostListItem[] = [
  {
    ...NO_AD,
    id: 'demo-a1',
    slug: 'demo-retinol',
    title: 'Ретинол без раздражения: порядок нанесения',
    excerpt: 'Как вводить ретинол осенью и с какими средствами его не совмещать.',
    coverImage: '/photos/m1.webp',
    kind: 'article',
    publishedAt: ago(3),
    createdAt: ago(3),
  },
  {
    ...NO_AD,
    id: 'demo-a2',
    slug: 'demo-spf',
    title: 'SPF зимой: нужен ли он в пасмурную погоду',
    excerpt: 'Ультрафиолет проходит сквозь облака, а снег отражает его почти полностью.',
    coverImage: null,
    kind: 'article',
    publishedAt: ago(9),
    createdAt: ago(9),
  },
  {
    isAd: true,
    advertiser: 'ООО «Пример»',
    erid: 'demo-erid-0001',
    id: 'demo-a3',
    slug: 'demo-hydration',
    title: 'Увлажнение в сухом воздухе: что меняется с октября',
    excerpt: 'Отопление сушит кожу сильнее мороза. Разбираем, какие текстуры помогают.',
    coverImage: '/photos/m4.webp',
    kind: 'article',
    publishedAt: ago(15),
    createdAt: ago(15),
  },
]

export const DEMO_NEWS: PublicPostListItem[] = [
  {
    ...NO_AD,
    id: 'demo-n1',
    slug: 'demo-news-1',
    title: 'Новая линейка ISSEIMI Nat Collection уже в каталоге',
    excerpt: 'Три средства на натуральной основе для ежедневного ухода.',
    coverImage: '/photos/m5-640.webp',
    kind: 'news',
    publishedAt: ago(2),
    createdAt: ago(2),
  },
  {
    ...NO_AD,
    id: 'demo-n2',
    slug: 'demo-news-2',
    title: 'Осенняя акция: бесплатная доставка от 6 000 ₽',
    excerpt: null,
    coverImage: '/photos/m14-640.webp',
    kind: 'news',
    publishedAt: ago(11),
    createdAt: ago(11),
  },
  {
    ...NO_AD,
    id: 'demo-n3',
    slug: 'demo-news-3',
    title: 'Изменился график работы пункта выдачи',
    excerpt: 'С 1 ноября пункт работает до 21:00 без выходных.',
    coverImage: '/photos/m16-640.webp',
    kind: 'news',
    publishedAt: ago(20),
    createdAt: ago(20),
  },
]

export const DEMO_VIDEOS: PublicVideoReview[] = [
  {
    id: 'demo-v1',
    authorName: 'Елена, Москва',
    caption: 'Утром и вечером, кожа стала ровнее за месяц.',
    mp4Url: '/video/2-3.mp4',
    webmUrl: null,
    posterUrl: '/video/posters/poster-2-3.jpg',
    product: { slug: 'hidrorrenovadora-krem-dlya-stimulirovaniya-tkanej', name: 'Крем для стимуляции тканей' },
  },
  {
    id: 'demo-v2',
    authorName: 'Марина, Казань',
    caption: null,
    mp4Url: '/video/3-5.mp4',
    webmUrl: null,
    posterUrl: '/video/posters/poster-3-5.jpg',
    product: null,
  },
  {
    id: 'demo-v3',
    authorName: 'Ольга, Тверь',
    caption: 'Пользуюсь вторую неделю, раздражения не было.',
    mp4Url: '/video/5-7.mp4',
    webmUrl: null,
    posterUrl: '/video/posters/poster-5-7.jpg',
    product: { slug: 'kerathor-plus-izotonicheskij-tonik', name: 'Изотонический тоник' },
  },
  {
    id: 'demo-v4',
    authorName: 'Ирина, Самара',
    caption: 'Беру после работы, кожа не стянута.',
    mp4Url: '/video/7-9.mp4',
    webmUrl: null,
    posterUrl: '/video/posters/poster-7-9.jpg',
    product: null,
  },
  {
    id: 'demo-v5',
    authorName: 'Наталья, Сочи',
    caption: 'Ровный тон к концу курса.',
    mp4Url: '/video/bestsellers/desktop/0-1.mp4',
    webmUrl: '/video/bestsellers/desktop/0-1.webm',
    posterUrl: '/video/bestsellers/desktop/k0.jpg',
    product: { slug: 'serum-triple-accion-syvorotka-trojnogo-dejstviya', name: 'Сыворотка тройного действия' },
  },
]
