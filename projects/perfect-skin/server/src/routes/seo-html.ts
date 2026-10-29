import { readFile, stat } from 'node:fs/promises'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import {
  isServicePath,
  metaForBlogList,
  metaForCategory,
  metaForHome,
  metaForNotFound,
  metaForPost,
  metaForProduct,
  metaForStatic,
  postPath,
  type PostKind,
  type SeoMeta,
} from '@ps/shared'
import { getProducts, getProductBySlug } from '../services/catalog.service.js'
import { loadNavCategories, type CategoryNode } from '../services/seo.service.js'
import { postService } from '../services/post.service.js'
import { ApiError } from '../lib/errors.js'
import { clientIndexPath, indexingOpen, publicUrl } from '../lib/env.js'
import { DISCONTINUED_SLUGS } from '../lib/discontinued.js'
import {
  absoluteUrl,
  blogListBody,
  catalogBody,
  categoryBody,
  contactsHtml,
  homeBody,
  isSafeLocalPath,
  postBody,
  productBody,
  productImagePath,
  renderPageHtml,
  siteBaseUrl,
  staticBody,
  withNoindex,
  type LinkItem,
  type ProductLinkView,
  type SeoPage,
} from '../lib/seo-html.js'
import { TtlCache } from '../lib/ttl-cache.js'
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  postJsonLd,
  productJsonLd,
} from '../lib/seo-jsonld.js'
import { extractProductSlugs } from '../lib/post-body.js'

type Outcome = { status: number; page: SeoPage } | { redirect: string }

interface Crumb {
  name: string
  path: string
}

interface ProductDetailView {
  name: string
  slug: string
  images: string[]
  description: string | null
  brand: { name: string; slug: string } | null
  categories: { name: string; slug: string }[]
  variants: { volumeLabel: string; retailPrice: number | null; priceHidden: boolean }[]
  minPrice: number | null
  priceHidden: boolean
  inStock: boolean
  seo: { title: string | null; description: string | null }
}

const STATIC_PATHS = new Set(['/brands', '/pro', '/consultation', '/about', '/contacts', '/offer', '/privacy'])

interface Template {
  mtimeMs: number
  html: string
}

interface RenderedHtml {
  status: number
  html: string
}

const HTML_CACHE_TTL_MS = 60_000
const HTML_CACHE_MAX_ENTRIES = 500
const CACHEABLE_STATUSES: ReadonlySet<number> = new Set([200, 404, 410])

let templateCache: Template | null = null
const htmlCache = new TtlCache<RenderedHtml>(HTML_CACHE_TTL_MS, HTML_CACHE_MAX_ENTRIES)
let htmlCacheMtimeMs: number | null = null

async function readTemplate(): Promise<Template> {
  const { mtimeMs } = await stat(clientIndexPath)
  if (templateCache && templateCache.mtimeMs === mtimeMs) return templateCache
  const html = await readFile(clientIndexPath, 'utf8')
  templateCache = { mtimeMs, html }
  return templateCache
}

function isPageRequest(method: string, pathname: string): boolean {
  return (method === 'GET' || method === 'HEAD') && !pathname.startsWith('/api/') && !/\.[a-z0-9]+$/i.test(pathname)
}

function canonicalFor(base: string, meta: SeoMeta): string | null {
  return meta.noindex || !meta.canonicalPath ? null : `${base}${meta.canonicalPath}`
}

function requestOrigin(request: FastifyRequest): string {
  return `${request.protocol}://${request.hostname}`
}

const ok = (page: SeoPage): Outcome => ({ status: 200, page })

function notFoundPage(): SeoPage {
  const meta = metaForNotFound()
  return {
    meta,
    canonicalUrl: null,
    ogType: 'website',
    ogImage: null,
    jsonLd: [],
    bodyHtml: staticBody(meta.h1, null, '<p><a href="/">На главную</a> · <a href="/catalog">Каталог</a></p>'),
  }
}

function goneOutcome(): Outcome {
  const meta: SeoMeta = {
    ...metaForNotFound(),
    title: 'Товар снят с продажи — Perfect Skin',
    description: 'Этот товар больше не выпускается',
    h1: 'Товар снят с продажи',
  }
  const page: SeoPage = {
    meta,
    canonicalUrl: null,
    ogType: 'website',
    ogImage: null,
    jsonLd: [],
    bodyHtml: staticBody(meta.h1, null, '<p><a href="/catalog">Смотреть каталог</a></p>'),
  }
  return { status: 410, page }
}

const NOT_FOUND: Outcome = { status: 404, page: notFoundPage() }

const HOME_CRUMB: Crumb = { name: 'Главная', path: '/' }
const CATALOG_CRUMB: Crumb = { name: 'Каталог', path: '/catalog' }

const crumbLinks = (crumbs: Crumb[]): LinkItem[] => crumbs.map((crumb) => ({ href: crumb.path, label: crumb.name }))

function toProductLink(product: { slug: string; name: string; brand: { name: string } | null; minPrice: number | null }): ProductLinkView {
  return { slug: product.slug, name: product.name, brandName: product.brand?.name ?? null, priceKop: product.minPrice }
}

async function homeOutcome(app: FastifyInstance, base: string): Promise<Outcome> {
  const [nav, popular] = await Promise.all([
    loadNavCategories(app.prisma),
    getProducts(app.prisma, { limit: 12, offset: 0, sort: 'popular' }, null),
  ])
  const meta = metaForHome()
  return ok({
    meta,
    canonicalUrl: canonicalFor(base, meta),
    ogType: 'website',
    ogImage: null,
    jsonLd: [organizationJsonLd(base)],
    bodyHtml: homeBody({
      h1: meta.h1,
      description: meta.description,
      categories: rootCategoryLinks(nav),
      popular: popular.items.map(toProductLink),
    }),
  })
}

function rootCategoryLinks(nav: CategoryNode[]): LinkItem[] {
  return nav
    .filter((category) => category.parentId === null && category.productCount > 0)
    .map((category) => ({ href: `/catalog/${category.slug}`, label: category.name }))
}

async function catalogOutcome(app: FastifyInstance, base: string): Promise<Outcome> {
  const nav = await loadNavCategories(app.prisma)
  const meta = metaForStatic('/catalog')
  return ok({
    meta,
    canonicalUrl: canonicalFor(base, meta),
    ogType: 'website',
    ogImage: null,
    jsonLd: [],
    bodyHtml: catalogBody({ h1: meta.h1, description: meta.description, categories: rootCategoryLinks(nav) }),
  })
}

async function categoryOutcome(app: FastifyInstance, base: string, slug: string): Promise<Outcome> {
  const isAll = slug === 'all'
  const nav = isAll ? [] : await loadNavCategories(app.prisma)
  const category = nav.find((item) => item.slug === slug)
  if (!isAll && !category) return NOT_FOUND

  const [list, cheapest] = await Promise.all([
    getProducts(app.prisma, { category: isAll ? undefined : slug, limit: 60, offset: 0, sort: 'newest' }, null),
    isAll
      ? Promise.resolve(null)
      : getProducts(app.prisma, { category: slug, limit: 1, offset: 0, sort: 'price_asc' }, null),
  ])

  const name = category?.name ?? 'Все средства'
  const meta = metaForCategory(
    { name, slug, seoTitle: category?.seoTitle, seoDescription: category?.seoDescription },
    list.total,
    cheapest?.items[0]?.minPrice ?? null,
  )
  const parent = category?.parentId ? nav.find((item) => item.id === category.parentId) : undefined
  const crumbs: Crumb[] = [
    HOME_CRUMB,
    CATALOG_CRUMB,
    ...(parent ? [{ name: parent.name, path: `/catalog/${parent.slug}` }] : []),
    { name, path: meta.canonicalPath ?? '/catalog/all' },
  ]
  const children = nav
    .filter((item) => category !== undefined && item.parentId === category.id && item.productCount > 0)
    .map((item) => ({ href: `/catalog/${item.slug}`, label: item.name }))

  return ok({
    meta,
    canonicalUrl: canonicalFor(base, meta),
    ogType: 'website',
    ogImage: null,
    jsonLd: [breadcrumbJsonLd(base, crumbs)],
    bodyHtml: categoryBody({
      h1: meta.h1,
      description: category?.description ?? null,
      children,
      products: list.items.map(toProductLink),
      total: list.total,
      breadcrumbs: crumbLinks(crumbs),
    }),
  })
}

async function productOutcome(app: FastifyInstance, base: string, slug: string): Promise<Outcome> {
  if (DISCONTINUED_SLUGS.has(slug)) return goneOutcome()
  const product: ProductDetailView | null = await getProductBySlug(app.prisma, slug, null)
  if (!product) return NOT_FOUND
  if (product.slug !== slug) return { redirect: `/product/${product.slug}` }

  const lowPriceKop = product.priceHidden ? null : product.minPrice
  const visiblePrices = product.variants.filter((v) => !v.priceHidden && v.retailPrice !== null).map((v) => v.retailPrice as number)
  const highPriceKop = visiblePrices.length > 0 ? Math.max(...visiblePrices) : null
  const meta = metaForProduct(
    {
      name: product.name,
      slug,
      brandName: product.brand?.name ?? null,
      seoTitle: product.seo.title,
      seoDescription: product.seo.description,
    },
    lowPriceKop,
  )
  const category = product.categories[0] ?? null
  const crumbs: Crumb[] = [
    HOME_CRUMB,
    CATALOG_CRUMB,
    ...(category ? [{ name: category.name, path: `/catalog/${category.slug}` }] : []),
    { name: product.name, path: `/product/${slug}` },
  ]
  const imageUrl = productImagePath(slug, product.images[0] ?? null)
  const absoluteImage = imageUrl ? absoluteUrl(base, imageUrl) : null
  const url = `${base}/product/${slug}`

  return ok({
    meta,
    canonicalUrl: canonicalFor(base, meta),
    ogType: 'product',
    ogImage: absoluteImage,
    jsonLd: [
      breadcrumbJsonLd(base, crumbs),
      productJsonLd({
        name: product.name,
        description: meta.description,
        url,
        imageUrl: absoluteImage,
        brandName: product.brand?.name ?? null,
        lowPriceKop,
        highPriceKop,
        offerCount: visiblePrices.length,
        inStock: product.inStock,
      }),
    ],
    bodyHtml: productBody({
      name: product.name,
      brand: product.brand ? { href: `/catalog?brand=${product.brand.slug}`, label: product.brand.name } : null,
      priceKop: lowPriceKop,
      inStock: product.inStock,
      volumes: product.variants.filter((v) => !v.priceHidden).map((v) => v.volumeLabel),
      description: product.description,
      category: category ? { href: `/catalog/${category.slug}`, label: category.name } : null,
      breadcrumbs: crumbLinks(crumbs),
    }),
  })
}

async function postOutcome(app: FastifyInstance, base: string, section: PostKind, slug: string): Promise<Outcome> {
  let post
  try {
    post = await postService.getPublicPostBySlug(slug)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return NOT_FOUND
    throw error
  }
  if (post.kind !== section) return { redirect: postPath(post.kind, post.slug) }

  const products = await postService.getProductsBySlug(extractProductSlugs(post.body), null)
  const meta = metaForPost({
    title: post.title,
    slug: post.slug,
    kind: post.kind,
    excerpt: post.excerpt,
    body: post.body,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
  })
  const publishedAt = post.publishedAt ?? post.createdAt
  const sectionMeta = metaForBlogList(section)
  const crumbs: Crumb[] = [
    HOME_CRUMB,
    { name: sectionMeta.h1, path: sectionMeta.canonicalPath ?? '/blog' },
    { name: post.title, path: postPath(section, post.slug) },
  ]
  const coverUrl = post.coverImage ? absoluteUrl(base, post.coverImage) : null

  return ok({
    meta,
    canonicalUrl: canonicalFor(base, meta),
    ogType: 'article',
    ogImage: coverUrl,
    jsonLd: [
      breadcrumbJsonLd(base, crumbs),
      postJsonLd({
        kind: post.kind,
        headline: post.title,
        description: meta.description,
        url: `${base}${postPath(section, post.slug)}`,
        imageUrl: coverUrl,
        publishedAt,
        updatedAt: post.updatedAt,
      }),
    ],
    bodyHtml: postBody({
      title: post.title,
      excerpt: post.excerpt,
      body: post.body,
      publishedAt,
      isAd: post.isAd,
      advertiser: post.advertiser,
      erid: post.erid,
      products: products.map(toProductLink),
      breadcrumbs: crumbLinks(crumbs),
    }),
  })
}

async function blogListOutcome(base: string, kind: PostKind): Promise<Outcome> {
  const list = await postService.listPosts({ publicOnly: true, kind, limit: 60, offset: 0 })
  const meta = metaForBlogList(kind)
  return ok({
    meta,
    canonicalUrl: canonicalFor(base, meta),
    ogType: 'website',
    ogImage: null,
    jsonLd: [],
    bodyHtml: blogListBody({
      h1: meta.h1,
      description: meta.description,
      posts: list.items.map((post) => ({ href: postPath(post.kind, post.slug), title: post.title, excerpt: post.excerpt })),
    }),
  })
}

function staticOutcome(path: string, base: string): Outcome {
  const meta = metaForStatic(path)
  const bodyHtml =
    path === '/contacts'
      ? staticBody(meta.h1, null, contactsHtml())
      : staticBody(meta.h1, meta.description, '<p><a href="/catalog">Перейти в каталог</a></p>')
  return ok({
    meta,
    canonicalUrl: canonicalFor(base, meta),
    ogType: 'website',
    ogImage: null,
    jsonLd: [],
    bodyHtml,
  })
}

function serviceOutcome(path: string): Outcome {
  const meta = metaForStatic(path)
  return ok({ meta, canonicalUrl: null, ogType: 'website', ogImage: null, jsonLd: [], bodyHtml: staticBody(meta.h1, null) })
}

async function resolve(app: FastifyInstance, path: string, base: string): Promise<Outcome> {
  if (!isSafeLocalPath(path)) return NOT_FOUND
  if (path === '/') return homeOutcome(app, base)
  if (path === '/catalog') return catalogOutcome(app, base)

  const category = /^\/catalog\/([a-z0-9-]{1,64})$/.exec(path)
  if (category) return categoryOutcome(app, base, category[1])

  const product = /^\/product\/([a-z0-9-]{1,120})$/.exec(path)
  if (product) return productOutcome(app, base, product[1])

  const blog = /^\/(blog|news)(?:\/([a-z0-9-]{1,100}))?$/.exec(path)
  if (blog) {
    const kind: PostKind = blog[1] === 'news' ? 'news' : 'article'
    return blog[2] ? postOutcome(app, base, kind, blog[2]) : blogListOutcome(base, kind)
  }

  if (STATIC_PATHS.has(path)) return staticOutcome(path, base)
  if (isServicePath(path)) return serviceOutcome(path)
  return NOT_FOUND
}

function sendHtml(reply: FastifyReply, status: number, html: string): FastifyReply {
  return reply.header('Cache-Control', 'no-cache').code(status).type('text/html; charset=utf-8').send(html)
}

// БД или рендер упали: сайт должен открыться, поэтому отдаём SPA-оболочку без разметки, но с noindex и 503.
async function sendShell(request: FastifyRequest, reply: FastifyReply, error: unknown): Promise<FastifyReply> {
  request.log.error({ err: error }, 'SEO HTML: разметка не собрана, отдаём оболочку клиента')
  reply.header('Cache-Control', 'no-store').header('Retry-After', '30')
  try {
    const { html } = await readTemplate()
    return reply.code(503).type('text/html; charset=utf-8').send(withNoindex(html))
  } catch (templateError) {
    request.log.error({ err: templateError }, 'SEO HTML: шаблон клиента не читается')
    return reply.code(503).type('text/plain; charset=utf-8').send('Service Unavailable')
  }
}

async function respond(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  pathname: string,
  search: string,
): Promise<FastifyReply> {
  const base = siteBaseUrl(publicUrl, requestOrigin(request))
  const key = `${base}|${pathname}${search}`
  try {
    const template = await readTemplate()
    if (template.mtimeMs !== htmlCacheMtimeMs) {
      htmlCache.clear()
      htmlCacheMtimeMs = template.mtimeMs
    }
    const cached = htmlCache.get(key)
    if (cached) return sendHtml(reply, cached.status, cached.html)

    const outcome = await resolve(app, pathname, base)
    if ('redirect' in outcome) return reply.redirect(301, `${outcome.redirect}${search}`)

    const rendered: RenderedHtml = {
      status: outcome.status,
      html: renderPageHtml(template.html, outcome.page, indexingOpen),
    }
    if (CACHEABLE_STATUSES.has(rendered.status)) htmlCache.set(key, rendered)
    return sendHtml(reply, rendered.status, rendered.html)
  } catch (error) {
    return sendShell(request, reply, error)
  }
}

export default fp(
  async function seoHtmlRoutes(app: FastifyInstance) {
    app.setNotFoundHandler({ preHandler: app.rateLimit({ max: 300, timeWindow: '1 minute' }) }, async (request, reply) => {
      const { pathname, search } = new URL(request.url, 'http://localhost')
      if (pathname === '/index.html' && (request.method === 'GET' || request.method === 'HEAD')) {
        return reply.redirect(301, `/${search}`)
      }
      if (!isPageRequest(request.method, pathname)) {
        return reply.code(404).send({ message: `Route ${request.method}:${request.url} not found`, error: 'Not Found', statusCode: 404 })
      }
      if (pathname.length > 1 && pathname.endsWith('/') && isSafeLocalPath(pathname)) {
        return reply.redirect(301, `${pathname.slice(0, -1)}${search}`)
      }
      return respond(app, request, reply, pathname, search)
    })
  },
  { name: 'seo-html' },
)
