import { CONTACTS, SITE_NAME, formatRub, type SeoMeta } from '@ps/shared'

export interface LinkItem {
  href: string
  label: string
}

export interface ProductLinkView {
  slug: string
  name: string
  brandName: string | null
  priceKop: number | null
}

export interface SeoPage {
  meta: SeoMeta
  canonicalUrl: string | null
  ogType: 'website' | 'product' | 'article'
  ogImage: string | null
  jsonLd: object[]
  bodyHtml: string
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function jsonLdScript(data: object): string {
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
  return `<script type="application/ld+json">${json}</script>`
}

export function siteBaseUrl(publicUrl: string, origin: string): string {
  return (publicUrl || origin).replace(/\/+$/, '')
}

export function absoluteUrl(base: string, path: string): string {
  return /^https?:\/\//.test(path) ? path : `${base}${path}`
}

// Та же логика, что client/src/lib/product-image.ts: загруженное фото берём как есть, остальные — из нарезки.
export function productImagePath(slug: string, image: string | null): string | null {
  if (!image) return null
  return image.startsWith('/uploads/') ? image : `/products-optimized/${slug}/card.webp`
}

export function formatDateRu(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' })
    .format(date)
    .replace(' г.', '')
}

export function renderPageHtml(template: string, page: SeoPage, indexingOpen: boolean): string {
  const noindex = !indexingOpen || page.meta.noindex === true
  const title = escapeHtml(page.meta.title)
  const description = escapeHtml(page.meta.description)
  const url = page.canonicalUrl ? escapeHtml(page.canonicalUrl) : null

  const head = [
    `<title>${title}</title>`,
    `<meta name="robots" content="${noindex ? 'noindex,nofollow' : 'index,follow'}">`,
    `<meta name="description" content="${description}">`,
    url ? `<link rel="canonical" href="${url}">` : '',
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    '<meta property="og:locale" content="ru_RU">',
    `<meta property="og:type" content="${page.ogType}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    url ? `<meta property="og:url" content="${url}">` : '',
    page.ogImage ? `<meta property="og:image" content="${escapeHtml(page.ogImage)}">` : '',
    ...page.jsonLd.map(jsonLdScript),
  ]
    .filter((line) => line !== '')
    .join('\n    ')

  const withoutOld = template
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace(/<meta name="description"[^>]*>\s*/, '')

  if (!withoutOld.includes('</head>') || !withoutOld.includes('<div id="root"></div>')) {
    throw new Error('index.html клиента не содержит </head> или <div id="root"></div>')
  }

  return withoutOld
    .replace('</head>', () => `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', () => `<div id="root"><main>${page.bodyHtml}</main></div>`)
}

const link = (item: LinkItem): string => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`

const linkList = (items: LinkItem[]): string =>
  items.length === 0 ? '' : `<ul>${items.map((item) => `<li>${link(item)}</li>`).join('')}</ul>`

const paragraph = (text: string | null | undefined): string => (text ? `<p>${escapeHtml(text)}</p>` : '')

function paragraphs(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map(paragraph)
    .join('')
}

function productListHtml(products: ProductLinkView[]): string {
  if (products.length === 0) return ''
  const items = products.map((product) => {
    const brand = product.brandName ? ` · ${escapeHtml(product.brandName)}` : ''
    const price = product.priceKop !== null ? ` · от ${formatRub(product.priceKop)}` : ''
    return `<li><a href="/product/${escapeHtml(product.slug)}">${escapeHtml(product.name)}</a>${brand}${price}</li>`
  })
  return `<ul>${items.join('')}</ul>`
}

export function breadcrumbsHtml(items: LinkItem[]): string {
  const parts = items.map((item, index) =>
    index === items.length - 1 ? `<li>${escapeHtml(item.label)}</li>` : `<li>${link(item)}</li>`,
  )
  return `<nav aria-label="Хлебные крошки"><ol>${parts.join('')}</ol></nav>`
}

export function staticBody(h1: string, description: string | null, extra = ''): string {
  return `<h1>${escapeHtml(h1)}</h1>${paragraph(description)}${extra}`
}

export function homeBody(input: {
  h1: string
  description: string
  categories: LinkItem[]
  popular: ProductLinkView[]
}): string {
  return [
    `<h1>${escapeHtml(input.h1)}</h1>`,
    paragraph(input.description),
    input.categories.length ? `<h2>Категории</h2>${linkList(input.categories)}` : '',
    input.popular.length ? `<h2>Популярные средства</h2>${productListHtml(input.popular)}` : '',
    contactsHtml(),
  ].join('')
}

export function contactsHtml(): string {
  return [
    `<p>Телефон: <a href="tel:${CONTACTS.phoneHref}">${escapeHtml(CONTACTS.phone)}</a>, ${escapeHtml(CONTACTS.hours)}</p>`,
    `<p>Email: <a href="mailto:${CONTACTS.email}">${escapeHtml(CONTACTS.email)}</a></p>`,
    `<p>Самовывоз: ${escapeHtml(CONTACTS.city)}, ${escapeHtml(CONTACTS.street)}</p>`,
  ].join('')
}

export function categoryBody(input: {
  h1: string
  description: string | null
  children: LinkItem[]
  products: ProductLinkView[]
  total: number
  breadcrumbs: LinkItem[]
}): string {
  return [
    breadcrumbsHtml(input.breadcrumbs),
    `<h1>${escapeHtml(input.h1)}</h1>`,
    paragraphs(input.description),
    input.children.length ? `<h2>Подкатегории</h2>${linkList(input.children)}` : '',
    input.total > 0 ? `<h2>Средства (${input.total})</h2>${productListHtml(input.products)}` : '',
  ].join('')
}

export function catalogBody(input: { h1: string; description: string | null; categories: LinkItem[] }): string {
  return [`<h1>${escapeHtml(input.h1)}</h1>`, paragraph(input.description), linkList(input.categories)].join('')
}

export function productBody(input: {
  name: string
  brand: LinkItem | null
  priceKop: number | null
  inStock: boolean
  volumes: string[]
  description: string | null
  category: LinkItem | null
  breadcrumbs: LinkItem[]
}): string {
  const brand = input.brand ? `<p>Бренд: ${link(input.brand)}</p>` : ''
  const price =
    input.priceKop !== null
      ? `<p>Цена: от ${formatRub(input.priceKop)}. ${input.inStock ? 'В наличии' : 'Нет в наличии'}</p>`
      : ''
  const volumes = input.volumes.length ? `<p>Объём: ${escapeHtml(input.volumes.join(', '))}</p>` : ''
  const category = input.category ? `<p>Категория: ${link(input.category)}</p>` : ''
  return [
    breadcrumbsHtml(input.breadcrumbs),
    `<h1>${escapeHtml(input.name)}</h1>`,
    brand,
    price,
    volumes,
    paragraphs(input.description),
    category,
  ].join('')
}

export function blogListBody(input: {
  h1: string
  description: string
  posts: { href: string; title: string; excerpt: string | null }[]
}): string {
  const items = input.posts.map(
    (post) => `<li><a href="${escapeHtml(post.href)}">${escapeHtml(post.title)}</a>${paragraph(post.excerpt)}</li>`,
  )
  return [
    `<h1>${escapeHtml(input.h1)}</h1>`,
    paragraph(input.description),
    items.length ? `<ul>${items.join('')}</ul>` : '',
  ].join('')
}

export function postBody(input: {
  title: string
  excerpt: string | null
  body: string
  publishedAt: Date
  isAd: boolean
  advertiser: string | null
  erid: string | null
  products: ProductLinkView[]
  breadcrumbs: LinkItem[]
}): string {
  const adParts = ['Реклама', input.advertiser, input.erid ? `erid: ${input.erid}` : null].filter(
    (part): part is string => Boolean(part),
  )
  const ad = input.isAd ? `<p>${escapeHtml(adParts.join(' · '))}</p>` : ''
  const products = input.products.length
    ? `<h2>Товары из статьи</h2>${productListHtml(input.products)}`
    : ''
  return [
    breadcrumbsHtml(input.breadcrumbs),
    `<h1>${escapeHtml(input.title)}</h1>`,
    ad,
    `<p><time datetime="${input.publishedAt.toISOString()}">${formatDateRu(input.publishedAt)}</time></p>`,
    paragraph(input.excerpt),
    markdownToHtml(input.body),
    products,
  ].join('')
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((\/[^)\s]*|https?:\/\/[^)\s]*)\)/g, '<a href="$2">$1</a>')
}

// Минимальный разбор тела статьи: заголовки, списки, абзацы, жирный и ссылки. Ссылки на товары убираем — они выводятся отдельным списком.
export function markdownToHtml(markdown: string): string {
  const out: string[] = []
  let list: 'ul' | 'ol' | null = null
  const closeList = (): void => {
    if (list) out.push(`</${list}>`)
    list = null
  }

  for (const raw of markdown.replace(/\[\[product:[a-z0-9-]+\]\]/g, '').split('\n')) {
    const line = raw.trim()
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    const numbered = /^\d+\.\s+(.*)$/.exec(line)

    if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol'
      if (list !== kind) {
        closeList()
        out.push(`<${kind}>`)
        list = kind
      }
      out.push(`<li>${inlineMarkdown((bullet ?? numbered)![1])}</li>`)
      continue
    }

    closeList()
    if (heading) {
      const level = Math.max(2, Math.min(heading[1].length, 3))
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`)
    } else if (line) {
      out.push(`<p>${inlineMarkdown(line)}</p>`)
    }
  }
  closeList()
  return out.join('')
}
