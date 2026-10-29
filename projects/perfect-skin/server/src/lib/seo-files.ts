import { escapeHtml } from './seo-html.js'

const CLOSED_PATHS = [
  '/admin',
  '/staff-login',
  '/auth',
  '/pro/register',
  '/checkout',
  '/orders',
  '/track',
  '/cart',
  '/favorites',
  '/account',
  '/api/',
  '/snapshot/',
]

const FILTER_PARAMS = ['q', 'sort', 'offset', 'pro', 'minPrice', 'maxPrice', 'need', 'skin', 'category']

export function buildRobotsTxt(indexingOpen: boolean, base: string): string {
  if (!indexingOpen) return 'User-agent: *\nDisallow: /\n'
  return [
    'User-agent: *',
    ...CLOSED_PATHS.map((path) => `Disallow: ${path}`),
    ...FILTER_PARAMS.map((param) => `Disallow: /*?*${param}=`),
    'Clean-param: sort /',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n')
}

export interface SitemapUrl {
  path: string
  lastmod: Date | null
}

export function buildSitemapXml(base: string, urls: SitemapUrl[]): string {
  const seen = new Set<string>()
  const entries = urls
    .filter((url) => {
      if (seen.has(url.path)) return false
      seen.add(url.path)
      return true
    })
    .map((url) => {
      const lastmod = url.lastmod ? `<lastmod>${url.lastmod.toISOString().slice(0, 10)}</lastmod>` : ''
      return `  <url><loc>${escapeHtml(`${base}${url.path}`)}</loc>${lastmod}</url>`
    })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n')
}
