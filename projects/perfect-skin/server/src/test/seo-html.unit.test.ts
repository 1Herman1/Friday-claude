import { readFileSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { metaForProduct, metaForHome } from '@ps/shared'
import {
  escapeHtml,
  isSafeLocalPath,
  jsonLdScript,
  markdownToHtml,
  postBody,
  productBody,
  productImagePath,
  renderPageHtml,
  siteBaseUrl,
  type SeoPage,
} from '../lib/seo-html.js'
import { organizationJsonLd, postJsonLd, productJsonLd, breadcrumbJsonLd } from '../lib/seo-jsonld.js'
import { TtlCache } from '../lib/ttl-cache.js'
import seoHtmlRoutes from '../routes/seo-html.js'
import type { PrismaClient } from '../lib/db.js'

const clientTemplatePath = new URL('../../../client/index.html', import.meta.url).pathname

vi.hoisted(() => {
  process.env.PS_CLIENT_INDEX = new URL('../../../client/index.html', import.meta.url).pathname
})

const template = readFileSync(clientTemplatePath, 'utf8')

function pageWith(overrides: Partial<SeoPage> = {}): SeoPage {
  return {
    meta: metaForHome(),
    canonicalUrl: 'https://perfect-skin.shop/',
    ogType: 'website',
    ogImage: null,
    jsonLd: [],
    bodyHtml: '<h1>Заголовок</h1>',
    ...overrides,
  }
}

describe('escapeHtml', () => {
  it('экранирует спецсимволы HTML и кавычки', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
  })
})

describe('jsonLdScript', () => {
  it('не даёт закрыть script строкой из пользовательских данных', () => {
    const script = jsonLdScript({ name: '</script><script>alert(1)</script>' })
    expect(script.startsWith('<script type="application/ld+json">')).toBe(true)
    expect(script.match(/<\/script>/g)).toHaveLength(1)
    expect(script).not.toContain('<script>alert')
    expect(JSON.parse(script.slice('<script type="application/ld+json">'.length, -'</script>'.length)).name).toBe(
      '</script><script>alert(1)</script>',
    )
  })
})

describe('renderPageHtml', () => {
  it('подставляет title, description, canonical и OG в реальный шаблон клиента', () => {
    const html = renderPageHtml(template, pageWith(), true)
    expect(html.match(/<title>/g)).toHaveLength(1)
    expect(html).toContain('<title>Магазин профессиональной косметики для лица в Москве — Perfect Skin</title>')
    expect(html.match(/<meta name="description"/g)).toHaveLength(1)
    expect(html).toContain('<link rel="canonical" href="https://perfect-skin.shop/">')
    expect(html).toContain('<meta property="og:title" content="Магазин профессиональной косметики для лица в Москве — Perfect Skin">')
    expect(html).toContain('<meta property="og:url" content="https://perfect-skin.shop/">')
    expect(html).toContain('<div id="root"><main><h1>Заголовок</h1></main></div>')
    expect(html).toContain('<script type="module" src="/src/main.tsx"></script>')
  })

  it('при закрытой индексации каждая страница noindex, даже с нормальной меткой', () => {
    const html = renderPageHtml(template, pageWith(), false)
    expect(html).toContain('<meta name="robots" content="noindex,nofollow">')
    expect(html).not.toContain('content="index,follow"')
  })

  it('при открытой индексации публичная страница index,follow', () => {
    const html = renderPageHtml(template, pageWith(), true)
    expect(html).toContain('<meta name="robots" content="index,follow">')
  })

  it('noindex-страница остаётся закрытой и при открытой индексации, без canonical', () => {
    const html = renderPageHtml(template, pageWith({ meta: { ...metaForHome(), noindex: true }, canonicalUrl: null }), true)
    expect(html).toContain('<meta name="robots" content="noindex,nofollow">')
    expect(html).not.toContain('rel="canonical"')
  })

  it('XSS через название товара не выходит за атрибуты и тело', () => {
    const meta = metaForProduct({ name: '"><script>alert(1)</script>', slug: 'x' }, null)
    const html = renderPageHtml(template, pageWith({ meta, bodyHtml: productBody({
      name: '"><script>alert(1)</script>',
      brand: null,
      priceKop: null,
      inStock: false,
      volumes: [],
      description: null,
      category: null,
      breadcrumbs: [],
    }) }), true)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('без нужных узлов в шаблоне падает с понятной ошибкой', () => {
    expect(() => renderPageHtml('<html><head></head><body></body></html>', pageWith(), true)).toThrow(/index.html/)
  })
})

describe('markdownToHtml', () => {
  it('### становится h3, ## и # — h2, ссылки на товары не выводятся', () => {
    const html = markdownToHtml('## Раздел\n\n### Подраздел\n\nТекст [[product:serum-a]] **жирный**')
    expect(html).toBe('<h2>Раздел</h2><h3>Подраздел</h3><p>Текст  <strong>жирный</strong></p>')
  })

  it('списки маркированные и нумерованные', () => {
    expect(markdownToHtml('- один\n- два\n\n1. первый\n2. второй')).toBe(
      '<ul><li>один</li><li>два</li></ul><ol><li>первый</li><li>второй</li></ol>',
    )
  })

  it('картинки из md не оставляют висящего восклицательного знака', () => {
    expect(markdownToHtml('![Подпись](/photos/a.webp)\n\nТекст')).toBe('<p>Текст</p>')
  })

  it('ссылки только на относительные и https-адреса, остальное — текст', () => {
    expect(markdownToHtml('[ок](/catalog)')).toBe('<p><a href="/catalog">ок</a></p>')
    expect(markdownToHtml('[плохо](javascript:alert(1))')).toBe('<p>[плохо](javascript:alert(1))</p>')
  })

  it('экранирует текст статьи', () => {
    expect(markdownToHtml('<img src=x onerror=alert(1)>')).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>')
  })
})

describe('postBody', () => {
  it('реклама выводит маркировку и erid, новость не получает лишнего', () => {
    const html = postBody({
      title: 'Заголовок',
      excerpt: null,
      body: 'Текст',
      publishedAt: new Date('2026-10-01T10:00:00Z'),
      isAd: true,
      advertiser: 'ИП Рыбко А. А.',
      erid: 'abc123',
      products: [],
      breadcrumbs: [],
    })
    expect(html).toContain('<p>Реклама · ИП Рыбко А. А. · erid: abc123</p>')
    expect(html).toContain('<time datetime="2026-10-01T10:00:00.000Z">')
  })

  it('без рекламы маркировки нет', () => {
    const html = postBody({
      title: 'T',
      excerpt: null,
      body: 'Текст',
      publishedAt: new Date('2026-10-01T10:00:00Z'),
      isAd: false,
      advertiser: null,
      erid: null,
      products: [],
      breadcrumbs: [],
    })
    expect(html).not.toContain('Реклама')
  })
})

describe('productImagePath', () => {
  it('загруженное фото — как есть, остальные — из нарезки по слагу', () => {
    expect(productImagePath('rf', '/uploads/products/a.jpg')).toBe('/uploads/products/a.jpg')
    expect(productImagePath('rf', '/photos/rf.png')).toBe('/products-optimized/rf/card.webp')
    expect(productImagePath('rf', null)).toBeNull()
  })
})

describe('siteBaseUrl', () => {
  it('PS_PUBLIC_URL важнее origin запроса, лишний слэш убирается', () => {
    expect(siteBaseUrl('https://perfect-skin.shop/', 'http://127.0.0.1:3000')).toBe('https://perfect-skin.shop')
    expect(siteBaseUrl('', 'http://localhost:3000')).toBe('http://localhost:3000')
  })
})

describe('JSON-LD', () => {
  it('Product без цены не получает offers', () => {
    const json = productJsonLd({
      name: 'Крем',
      description: 'Описание',
      url: 'https://x/product/k',
      imageUrl: null,
      brandName: 'ISSEIMI',
      lowPriceKop: null,
      highPriceKop: null,
      offerCount: 0,
      inStock: false,
    })
    expect(json).not.toHaveProperty('offers')
    expect(json).toMatchObject({ '@type': 'Product', brand: { '@type': 'Brand', name: 'ISSEIMI' } })
  })

  it('Product с ценой: AggregateOffer в рублях, из копеек', () => {
    const json = productJsonLd({
      name: 'Крем',
      description: 'Описание',
      url: 'https://x/product/k',
      imageUrl: 'https://x/products-optimized/k/card.webp',
      brandName: null,
      lowPriceKop: 299000,
      highPriceKop: 450000,
      offerCount: 2,
      inStock: true,
    })
    expect(json).toMatchObject({
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'RUB',
        lowPrice: 2990,
        highPrice: 4500,
        offerCount: 2,
        availability: 'https://schema.org/InStock',
      },
    })
    expect(json).not.toHaveProperty('brand')
  })

  it('новость — NewsArticle, статья — BlogPosting; даты в ISO', () => {
    const base = {
      headline: 'H',
      description: 'D',
      url: 'https://x/news/a',
      imageUrl: null,
      publishedAt: new Date('2026-10-01T10:00:00Z'),
      updatedAt: new Date('2026-10-02T10:00:00Z'),
    }
    expect(postJsonLd({ ...base, kind: 'news' })).toMatchObject({
      '@type': 'NewsArticle',
      datePublished: '2026-10-01T10:00:00.000Z',
      dateModified: '2026-10-02T10:00:00.000Z',
    })
    expect(postJsonLd({ ...base, kind: 'article' })['@type']).toBe('BlogPosting')
  })

  it('Organization с телефоном и адресом, BreadcrumbList с абсолютными адресами', () => {
    expect(organizationJsonLd('https://perfect-skin.shop')).toMatchObject({
      '@type': 'Organization',
      name: 'Perfect Skin',
      telephone: '+7-495-183-28-48',
      address: { streetAddress: 'Звенигородское шоссе, 3Ас1', addressLocality: 'Москва' },
    })
    expect(breadcrumbJsonLd('https://perfect-skin.shop', [{ name: 'Главная', path: '/' }, { name: 'Каталог', path: '/catalog' }])).toMatchObject({
      itemListElement: [
        { position: 1, item: 'https://perfect-skin.shop/' },
        { position: 2, item: 'https://perfect-skin.shop/catalog' },
      ],
    })
  })
})

describe('isSafeLocalPath', () => {
  it('пропускает только адреса с одним ведущим слэшем', () => {
    expect(isSafeLocalPath('/')).toBe(true)
    expect(isSafeLocalPath('/catalog/rf')).toBe(true)
    expect(isSafeLocalPath('//evil.com/')).toBe(false)
    expect(isSafeLocalPath('/\\evil.com/')).toBe(false)
    expect(isSafeLocalPath('/a\\b')).toBe(false)
    expect(isSafeLocalPath('evil.com')).toBe(false)
  })
})

describe('TtlCache', () => {
  it('отдаёт значение в пределах TTL и забывает его после', () => {
    const cache = new TtlCache<string>(1000, 10)
    cache.set('a', 'x', 0)
    expect(cache.get('a', 999)).toBe('x')
    expect(cache.get('a', 1000)).toBeUndefined()
  })

  it('при переполнении вытесняет давно не читанную запись', () => {
    const cache = new TtlCache<number>(60_000, 2)
    cache.set('a', 1, 0)
    cache.set('b', 2, 0)
    cache.get('a', 0)
    cache.set('c', 3, 0)
    expect(cache.get('b', 0)).toBeUndefined()
    expect(cache.get('a', 0)).toBe(1)
    expect(cache.get('c', 0)).toBe(3)
  })
})

async function buildSeoApp(prisma: unknown) {
  const app = Fastify()
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' })
  app.decorate('prisma', prisma as PrismaClient)
  await app.register(seoHtmlRoutes)
  await app.listen({ port: 0, host: '127.0.0.1' })
  return app
}

// Сырой путь по сети: inject нормализует URL и подменил бы `/.//host/` на `//host/` до обработчика.
function rawGet(app: Awaited<ReturnType<typeof buildSeoApp>>, path: string): Promise<{ status: number; location?: string }> {
  const { port } = app.server.address() as AddressInfo
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      res.resume()
      resolve({ status: res.statusCode ?? 0, location: res.headers.location })
    })
    req.on('error', reject)
    req.end()
  })
}

describe('SEO HTML route', () => {
  it.each(['/.//evil.com/', '/a/..//evil.com/', '/%2e//evil.com/'])(
    'путь %s не редиректит наружу: 404 без Location',
    async (path) => {
      const app = await buildSeoApp({})
      const res = await rawGet(app, path)
      expect(res.status).toBe(404)
      expect(res.location).toBeUndefined()
      await app.close()
    },
  )

  it('обычный слэш в конце снимается внутренним 301', async () => {
    const app = await buildSeoApp({})
    const res = await rawGet(app, '/about/?x=1')
    expect(res.status).toBe(301)
    expect(res.location).toBe('/about?x=1')
    await app.close()
  })

  it('отказ БД: 503 с оболочкой клиента, noindex и без кэширования', async () => {
    const failingPrisma = {
      category: { findMany: async () => { throw new Error('db down') } },
      productCategory: { findMany: async () => [] },
    }
    const app = await buildSeoApp(failingPrisma)
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(503)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.headers['retry-after']).toBe('30')
    expect(res.body).toContain('<meta name="robots" content="noindex,nofollow">')
    expect(res.body).toContain('<div id="root"></div>')
    expect(res.body).not.toContain('<main>')
    await app.close()
  })

  it('повторный запрос страницы из кэша не ходит в базу', async () => {
    const findMany = vi.fn(async () => [])
    const prisma = {
      category: { findMany },
      productCategory: { findMany: async () => [] },
    }
    const app = await buildSeoApp(prisma)
    const first = await app.inject({ method: 'GET', url: '/catalog' })
    const callsAfterFirst = findMany.mock.calls.length
    const second = await app.inject({ method: 'GET', url: '/catalog' })
    expect(first.statusCode).toBe(200)
    expect(second.body).toBe(first.body)
    expect(findMany.mock.calls.length).toBe(callsAfterFirst)
    await app.close()
  })
})
