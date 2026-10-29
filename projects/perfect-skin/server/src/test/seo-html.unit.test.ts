import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { metaForProduct, metaForHome } from '@ps/shared'
import {
  escapeHtml,
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

const template = readFileSync(new URL('../../../client/index.html', import.meta.url), 'utf8')

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
