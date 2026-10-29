export type PostKind = 'article' | 'news'

export interface SeoMeta {
  title: string
  description: string
  h1: string
  canonicalPath: string | null
  noindex?: boolean
}

export interface CategorySeoInput {
  name: string
  slug: string
  seoTitle?: string | null
  seoDescription?: string | null
}

export interface ProductSeoInput {
  name: string
  slug: string
  brandName?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
}

export interface PostSeoInput {
  title: string
  slug: string
  kind: PostKind
  excerpt?: string | null
  body: string
  seoTitle?: string | null
  seoDescription?: string | null
}

export const SITE_NAME = 'Perfect Skin'
export const DEFAULT_TITLE = 'Perfect Skin — про-косметика из Испании'
export const DEFAULT_DESCRIPTION =
  'Профессиональная косметика испанских брендов ISSEIMI и GLACÉE Skincare. Назначают врачи. Любит ваша кожа.'

export const CONTACTS = {
  phone: '+7 (495) 183-28-48',
  phoneHref: '+74951832848',
  email: 'mail@perfect-skin.shop',
  street: 'Звенигородское шоссе, 3Ас1',
  city: 'Москва',
  hours: 'Пн–Пт 10:00–21:00, Сб 11:00–17:00',
} as const

const DELIVERY_NOTE = 'Доставка СДЭК, бесплатно от 6 000 ₽, самовывоз в Москве'

const SERVICE_PREFIXES = [
  '/admin',
  '/auth',
  '/checkout',
  '/orders',
  '/track',
  '/cart',
  '/favorites',
  '/staff-login',
  '/pro/register',
  '/account',
] as const

const BLOG_TEXT: Record<PostKind, { title: string; sub: string; path: string }> = {
  article: {
    title: 'Статьи об уходе',
    sub: 'Полезная информация о косметологии, уходе за кожей и новых товарах от ISSEIMI и GLACÉE Skincare.',
    path: '/blog',
  },
  news: {
    title: 'Новости',
    sub: 'Поступления, акции и изменения в работе магазина.',
    path: '/news',
  },
}

export function formatRub(kopecks: number): string {
  const rubles = Math.round(kopecks / 100)
  return `${String(rubles).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`
}

export function pluralize(count: number, forms: [string, string, string]): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
  return forms[2]
}

export function plainText(markdown: string): string {
  return markdown
    .replace(/\[\[product:[^\]]*\]\]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function truncate(text: string, max = 160): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export function postPath(kind: PostKind, slug: string): string {
  return `${BLOG_TEXT[kind].path}/${slug}`
}

export function isServicePath(path: string): boolean {
  return SERVICE_PREFIXES.some((prefix) => path.startsWith(prefix))
}

export function metaForHome(): SeoMeta {
  return {
    title: 'Магазин профессиональной косметики для лица в Москве — Perfect Skin',
    description: `ISSEIMI и GLACÉE от Heber Farma (Испания). ${DELIVERY_NOTE}`,
    h1: 'Профессиональная косметика для лица из Испании',
    canonicalPath: '/',
  }
}

export function metaForCategory(
  cat: CategorySeoInput,
  productCount: number,
  minPriceKop: number | null,
): SeoMeta {
  const h1 = /\sдля\s/i.test(cat.name) ? cat.name : `${cat.name} для лица`
  const priceText = minPriceKop !== null ? `, от ${formatRub(minPriceKop)}` : ''
  const countText =
    productCount > 0 ? `${productCount} ${pluralize(productCount, ['средство', 'средства', 'средств'])} ISSEIMI и GLACÉE${priceText}. ` : ''
  return {
    title: cat.seoTitle || `${h1} — купить профессиональные в Москве`,
    description: cat.seoDescription || `${countText}Доставка по России`,
    h1,
    canonicalPath: `/catalog/${cat.slug}`,
  }
}

export function metaForProduct(product: ProductSeoInput, minPriceKop: number | null): SeoMeta {
  const brand = product.brandName ? ` ${product.brandName}` : ''
  const priceText = minPriceKop !== null ? ` от ${formatRub(minPriceKop)}` : ''
  return {
    title: product.seoTitle || `${product.name}${brand}: купить в Москве — Perfect Skin`,
    description: product.seoDescription || `Купить ${product.name}${brand}${priceText}. Доставка СДЭК, самовывоз в Москве`,
    h1: product.name,
    canonicalPath: `/product/${product.slug}`,
  }
}

export function metaForPost(post: PostSeoInput): SeoMeta {
  return {
    title: post.seoTitle || `${post.title} — Perfect Skin`,
    description:
      post.seoDescription || post.excerpt || truncate(plainText(post.body)),
    h1: post.title,
    canonicalPath: postPath(post.kind, post.slug),
  }
}

export function metaForBlogList(kind: PostKind): SeoMeta {
  const text = BLOG_TEXT[kind]
  return {
    title: `${text.title} — Perfect Skin`,
    description: text.sub,
    h1: text.title,
    canonicalPath: text.path,
  }
}

export function metaForNotFound(): SeoMeta {
  return {
    title: 'Страница не найдена — Perfect Skin',
    description: DEFAULT_DESCRIPTION,
    h1: 'Страница не найдена',
    canonicalPath: null,
    noindex: true,
  }
}

export function metaForStatic(path: string): SeoMeta {
  if (isServicePath(path)) {
    return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, h1: SITE_NAME, canonicalPath: path, noindex: true }
  }
  switch (path) {
    case '/catalog':
      return {
        title: 'Каталог профессиональной косметики для лица — Perfect Skin',
        description: `Каталог ISSEIMI и GLACÉE от Heber Farma (Испания). ${DELIVERY_NOTE}`,
        h1: 'Каталог профессиональной косметики для лица',
        canonicalPath: '/catalog',
      }
    case '/brands':
      return {
        title: 'Испанская профессиональная косметика ISSEIMI и GLACÉE — Perfect Skin',
        description: 'Два бренда, одно производство: ISSEIMI и GLACÉE Skincare от Heber Farma (Испания)',
        h1: 'Испанская профессиональная косметика Heber Farma',
        canonicalPath: '/brands',
      }
    case '/pro':
      return {
        title: 'Косметика для косметологов — ISSEIMI и GLACÉE оптом',
        description: 'Как получить доступ к ценам для специалистов: заявка, проверка и вход в кабинет',
        h1: 'Профессиональная косметика для косметологов',
        canonicalPath: '/pro',
      }
    case '/consultation':
      return {
        title: 'Консультация косметолога по подбору ухода — Perfect Skin',
        description: 'Опишите задачу или кожный вопрос — косметолог перезвонит или напишет в удобном мессенджере',
        h1: 'Консультация косметолога по подбору ухода',
        canonicalPath: '/consultation',
      }
    case '/about':
      return {
        title: 'О магазине Perfect Skin — профессиональная косметика',
        description: 'Perfect Skin — магазин профессиональной косметики ISSEIMI и GLACÉE в Москве',
        h1: 'Perfect Skin — пространство экспертной заботы о вашей коже',
        canonicalPath: '/about',
      }
    case '/contacts':
      return {
        title: 'Контакты магазина Perfect Skin в Москве',
        description: `Телефон ${CONTACTS.phone}, ${CONTACTS.hours}. Самовывоз: ${CONTACTS.city}, ${CONTACTS.street}`,
        h1: 'Контакты',
        canonicalPath: '/contacts',
      }
    case '/offer':
      return {
        title: 'Публичная оферта — Perfect Skin',
        description: DEFAULT_DESCRIPTION,
        h1: 'Публичная оферта',
        canonicalPath: '/offer',
      }
    case '/privacy':
      return {
        title: 'Политика обработки персональных данных — Perfect Skin',
        description: DEFAULT_DESCRIPTION,
        h1: 'Политика обработки персональных данных',
        canonicalPath: '/privacy',
      }
    default:
      return metaForNotFound()
  }
}
