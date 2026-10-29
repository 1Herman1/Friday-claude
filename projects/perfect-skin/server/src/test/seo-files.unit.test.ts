import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildRobotsTxt, buildSitemapXml } from '../lib/seo-files.js'
import { siteBaseUrl } from '../lib/seo-html.js'
import { indexingEnabled } from '../lib/env.js'
import type { PrismaClient } from '../lib/db.js'
import { countCategoryProducts, loadNavCategories } from '../services/seo.service.js'

describe('buildRobotsTxt', () => {
  it('при закрытой индексации — полный запрет и без sitemap', () => {
    expect(buildRobotsTxt(false, 'https://perfect-skin.shop')).toBe('User-agent: *\nDisallow: /\n')
  })

  it('при открытой — служебные пути, фильтры, Clean-param и sitemap', () => {
    const txt = buildRobotsTxt(true, 'https://perfect-skin.shop')
    expect(txt).toContain('Disallow: /admin\n')
    expect(txt).toContain('Disallow: /api/\n')
    expect(txt).toContain('Disallow: /snapshot/\n')
    expect(txt).toContain('Disallow: /*?*q=\n')
    expect(txt).toContain('Disallow: /*?*sort=\n')
    expect(txt).toContain('Disallow: /*?*offset=\n')
    expect(txt).toContain('Disallow: /*?*minPrice=\n')
    expect(txt).toContain('Disallow: /*?*skin=\n')
    expect(txt).toContain('Clean-param: sort /\n')
    expect(txt.trimEnd().endsWith('Sitemap: https://perfect-skin.shop/sitemap.xml')).toBe(true)
    expect(txt).not.toContain('Disallow: /\n')
  })

  it('brand не закрыт: до появления страниц брендов это их единственные адреса', () => {
    expect(buildRobotsTxt(true, 'https://x')).not.toContain('brand')
  })
})

describe('buildSitemapXml', () => {
  it('собирает urlset с абсолютными адресами и lastmod по дате', () => {
    const xml = buildSitemapXml('https://perfect-skin.shop', [
      { path: '/', lastmod: null },
      { path: '/product/rf', lastmod: new Date('2026-10-05T12:00:00Z') },
    ])
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<url><loc>https://perfect-skin.shop/</loc></url>')
    expect(xml).toContain('<url><loc>https://perfect-skin.shop/product/rf</loc><lastmod>2026-10-05</lastmod></url>')
  })

  it('убирает дубли путей и экранирует адрес', () => {
    const xml = buildSitemapXml('https://x', [
      { path: '/catalog', lastmod: null },
      { path: '/catalog', lastmod: null },
      { path: '/a?b=1&c=2', lastmod: null },
    ])
    expect(xml.match(/<loc>https:\/\/x\/catalog<\/loc>/g)).toHaveLength(1)
    expect(xml).toContain('<loc>https://x/a?b=1&amp;c=2</loc>')
  })
})

describe('countCategoryProducts', () => {
  it('товар из подкатегории считается и в родителе, но один раз', () => {
    const counts = countCategoryProducts(
      [
        { id: 'root', parentId: null },
        { id: 'child', parentId: 'root' },
        { id: 'empty', parentId: null },
      ],
      [
        { categoryId: 'child', productId: 'p1' },
        { categoryId: 'root', productId: 'p1' },
        { categoryId: 'root', productId: 'p2' },
      ],
    )
    expect(counts.get('root')).toBe(2)
    expect(counts.get('child')).toBe(1)
    expect(counts.get('empty')).toBe(0)
  })

  it('циклический parentId не зацикливает подсчёт', () => {
    const counts = countCategoryProducts(
      [
        { id: 'a', parentId: 'b' },
        { id: 'b', parentId: 'a' },
      ],
      [{ categoryId: 'a', productId: 'p' }],
    )
    expect(counts.get('a')).toBe(1)
    expect(counts.get('b')).toBe(1)
  })
})

describe('indexingEnabled', () => {
  it('открыта только при PS_INDEXING=on и заданном PS_PUBLIC_URL', () => {
    expect(indexingEnabled('on', 'https://perfect-skin.shop')).toBe(true)
  })

  it('без PS_PUBLIC_URL или с другим значением флага — закрыта', () => {
    expect(indexingEnabled('on', '')).toBe(false)
    expect(indexingEnabled('on', '   ')).toBe(false)
    expect(indexingEnabled('off', 'https://perfect-skin.shop')).toBe(false)
    expect(indexingEnabled(undefined, 'https://perfect-skin.shop')).toBe(false)
  })

  it('при открытой индексации база адресов — PS_PUBLIC_URL, подменённый Host не влияет', () => {
    expect(siteBaseUrl('https://perfect-skin.shop', 'https://evil.example')).toBe('https://perfect-skin.shop')
  })

  it('PS_INDEXING=on без PS_PUBLIC_URL: robots остаётся полным запретом даже при подменённом Host', () => {
    expect(buildRobotsTxt(indexingEnabled('on', ''), 'https://evil.example')).toBe('User-agent: *\nDisallow: /\n')
  })
})

describe('loadNavCategories cache', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('повторный вызов в пределах 60 с не идёт в базу, после TTL — снова', async () => {
    vi.useFakeTimers()
    const category = { findMany: vi.fn(async () => []) }
    const productCategory = { findMany: vi.fn(async () => []) }
    const prisma = { category, productCategory } as unknown as PrismaClient

    await loadNavCategories(prisma)
    await loadNavCategories(prisma)
    expect(category.findMany).toHaveBeenCalledTimes(1)

    vi.setSystemTime(Date.now() + 60_001)
    await loadNavCategories(prisma)
    expect(category.findMany).toHaveBeenCalledTimes(2)
  })
})
