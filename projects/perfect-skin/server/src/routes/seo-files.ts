import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { postPath } from '@ps/shared'
import { indexingOpen, publicUrl } from '../lib/env.js'
import { buildRobotsTxt, buildSitemapXml, type SitemapUrl } from '../lib/seo-files.js'
import { siteBaseUrl } from '../lib/seo-html.js'
import { DISCONTINUED_SLUGS } from '../lib/discontinued.js'
import { loadNavCategories, loadPublicPostsForSitemap, loadVisibleProductsForSitemap } from '../services/seo.service.js'

const STATIC_SITEMAP_PATHS = ['/', '/catalog', '/blog', '/news', '/brands', '/about', '/contacts', '/pro', '/consultation']

export default fp(
  async function seoFilesRoutes(app: FastifyInstance) {
    app.get('/robots.txt', async (request, reply) => {
      const base = siteBaseUrl(publicUrl, `${request.protocol}://${request.hostname}`)
      reply.header('Cache-Control', 'no-cache')
      return reply.type('text/plain; charset=utf-8').send(buildRobotsTxt(indexingOpen, base))
    })

    app.get('/sitemap.xml', async (request, reply) => {
      const base = siteBaseUrl(publicUrl, `${request.protocol}://${request.hostname}`)
      const [categories, products, posts] = await Promise.all([
        loadNavCategories(app.prisma),
        loadVisibleProductsForSitemap(app.prisma),
        loadPublicPostsForSitemap(app.prisma),
      ])

      const urls: SitemapUrl[] = [
        ...STATIC_SITEMAP_PATHS.map((path) => ({ path, lastmod: null })),
        ...categories
          .filter((category) => category.productCount > 0)
          .map((category) => ({ path: `/catalog/${category.slug}`, lastmod: category.updatedAt })),
        ...products
          .filter((product) => !DISCONTINUED_SLUGS.has(product.slug))
          .map((product) => ({ path: `/product/${product.slug}`, lastmod: product.updatedAt })),
        ...posts.map((post) => ({ path: postPath(post.kind, post.slug), lastmod: post.updatedAt })),
      ]

      reply.header('Cache-Control', 'public, max-age=600')
      return reply.type('application/xml; charset=utf-8').send(buildSitemapXml(base, urls))
    })
  },
  { name: 'seo-files' },
)
