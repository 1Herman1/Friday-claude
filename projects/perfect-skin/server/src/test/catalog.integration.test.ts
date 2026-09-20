import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import prismaPlugin from '../plugins/prisma.js'
import authenticatePlugin from '../plugins/authenticate.js'
import { ApiError, errorResponse } from '../lib/errors.js'
import { registerCommonSchemas } from '../schemas/common.js'
import productsRoutes from '../routes/products/index.js'
import categoriesRoutes from '../routes/categories/index.js'
import brandsRoutes from '../routes/brands/index.js'
import linesRoutes from '../routes/lines/index.js'

let app: FastifyInstance

async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false,
  })

  registerCommonSchemas(fastify)

  await fastify.register(prismaPlugin)
  await fastify.register(cookie, {
    secret: process.env.PS_COOKIE_SECRET || 'dev-secret',
    hook: 'preHandler',
  })
  await fastify.register(cors, {
    origin: 'http://localhost:3000',
    credentials: true,
  })
  await fastify.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  })
  await fastify.register(authenticatePlugin)

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.status).send(errorResponse(error))
    }

    fastify.log.error({ error })
    reply.status(500).send(
      errorResponse(
        new ApiError(500, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера')
      )
    )
  })

  // Register catalog routes
  await fastify.register(productsRoutes, { prefix: '/api/v1/products' })
  await fastify.register(categoriesRoutes, { prefix: '/api/v1/categories' })
  await fastify.register(brandsRoutes, { prefix: '/api/v1/brands' })
  await fastify.register(linesRoutes, { prefix: '/api/v1/lines' })

  return fastify
}

describe('Catalog Integration Tests', () => {
  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /api/v1/products', () => {
    it('should return products with pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products',
        query: { limit: '10', offset: '0' },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('items')
      expect(body).toHaveProperty('total')
      expect(body).toHaveProperty('limit')
      expect(body).toHaveProperty('offset')
      expect(Array.isArray(body.items)).toBe(true)
    })

    it('should filter by need and skin type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products?need=hydration&skin=dry',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(Array.isArray(body.items)).toBe(true)
      // Each item should have needs and skin types
      for (const item of body.items) {
        expect(item).toHaveProperty('needs')
        expect(item).toHaveProperty('skinTypes')
      }
    })

    it('should filter by price range', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products?minPrice=100000&maxPrice=500000',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(Array.isArray(body.items)).toBe(true)
      // Each item should have minPrice in range
      for (const item of body.items) {
        expect(item.minPrice).toBeGreaterThanOrEqual(100000)
        expect(item.minPrice).toBeLessThanOrEqual(500000)
      }
    })

    it('should sort by price ascending', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products?sort=price_asc&limit=30',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      const prices = body.items.map((item: any) => item.minPrice)
      // Check prices are sorted
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1])
      }
    })

    it('should be stable at pagination with equal prices (use id as secondary sort)', async () => {
      // Get first two pages
      const page1 = await app.inject({
        method: 'GET',
        url: '/api/v1/products?sort=price_asc&limit=10&offset=0',
      })
      const page2 = await app.inject({
        method: 'GET',
        url: '/api/v1/products?sort=price_asc&limit=10&offset=10',
      })

      expect(page1.statusCode).toBe(200)
      expect(page2.statusCode).toBe(200)

      const body1 = JSON.parse(page1.body)
      const body2 = JSON.parse(page2.body)

      // Ensure no overlap in IDs between consecutive pages
      const page1Ids = new Set(body1.items.map((item: any) => item.id))
      const page2Ids = new Set(body2.items.map((item: any) => item.id))

      for (const id of page1Ids) {
        expect(page2Ids.has(id)).toBe(false)
      }
    })

    it('should reject invalid price range', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products?minPrice=500000&maxPrice=100000',
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject unknown need value', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products?need=invalid_need',
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should reject unknown skin type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products?skin=invalid_skin',
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /api/v1/products/facets', () => {
    it('should return facets', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/facets',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('categories')
      expect(body).toHaveProperty('brands')
      expect(body).toHaveProperty('lines')
      expect(body).toHaveProperty('needs')
      expect(body).toHaveProperty('skinTypes')
      expect(body).toHaveProperty('price')
      expect(Array.isArray(body.categories)).toBe(true)
      expect(Array.isArray(body.brands)).toBe(true)
    })

    it('should not zero out own group when filtered', async () => {
      // Get facets without filter
      const unfiltered = await app.inject({
        method: 'GET',
        url: '/api/v1/products/facets',
      })
      const unfilteredBody = JSON.parse(unfiltered.body)

      // Get facets with brand filter
      const filtered = await app.inject({
        method: 'GET',
        url: '/api/v1/products/facets?brand=isseimi',
      })
      const filteredBody = JSON.parse(filtered.body)

      // The brand facet should still show ISSEIMI even with brand=isseimi filter
      const isseimi = filteredBody.brands.find((b: any) => b.value === 'isseimi')
      expect(isseimi).toBeDefined()
      expect(isseimi.count).toBeGreaterThan(0)
    })

    it('should reject sort, limit, offset params', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/facets?sort=price_asc',
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /api/v1/products/:slug', () => {
    it('should return product card with ingredients', async () => {
      // First, get a product from the list
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/products?limit=1',
      })
      const listBody = JSON.parse(listResponse.body)
      if (listBody.items.length === 0) {
        console.log('No products in database for testing')
        return
      }

      const slug = listBody.items[0].slug

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${slug}`,
      })

      if (response.statusCode !== 200) {
        console.log('Error response:', response.body)
      }
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('id')
      expect(body).toHaveProperty('slug')
      expect(body).toHaveProperty('name')
      expect(body).toHaveProperty('description')
      expect(body).toHaveProperty('ingredients')
      expect(Array.isArray(body.ingredients)).toBe(true)
      expect(body).toHaveProperty('images')
      expect(Array.isArray(body.images)).toBe(true)
      expect(body).toHaveProperty('categories')
      expect(Array.isArray(body.categories)).toBe(true)
      expect(body).toHaveProperty('seo')
    })

    it('should return 404 for non-existent product', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/non-existent-slug-12345',
      })

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('PRODUCT_NOT_FOUND')
    })
  })

  describe('GET /api/v1/categories/tree', () => {
    it('should return category tree', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/categories/tree',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(Array.isArray(body)).toBe(true)
      if (body.length > 0) {
        expect(body[0]).toHaveProperty('id')
        expect(body[0]).toHaveProperty('name')
        expect(body[0]).toHaveProperty('slug')
        expect(body[0]).toHaveProperty('productCount')
        expect(body[0]).toHaveProperty('children')
        expect(Array.isArray(body[0].children)).toBe(true)
      }
    })
  })

  describe('GET /api/v1/categories/:slug', () => {
    it('should return category detail', async () => {
      // First get categories tree
      const treeResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/categories/tree',
      })
      const tree = JSON.parse(treeResponse.body)
      if (tree.length === 0) {
        console.log('No categories in database for testing')
        return
      }

      const slug = tree[0].slug

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/categories/${slug}`,
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('id')
      expect(body).toHaveProperty('name')
      expect(body).toHaveProperty('slug')
      expect(body).toHaveProperty('productCount')
      expect(body).toHaveProperty('seo')
    })

    it('should return 404 for non-existent category', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/categories/non-existent-category',
      })

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('CATEGORY_NOT_FOUND')
    })
  })

  describe('GET /api/v1/brands', () => {
    it('should return list of brands', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/brands',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(Array.isArray(body)).toBe(true)
      if (body.length > 0) {
        expect(body[0]).toHaveProperty('id')
        expect(body[0]).toHaveProperty('name')
        expect(body[0]).toHaveProperty('slug')
        expect(body[0]).toHaveProperty('productCount')
      }
    })
  })

  describe('GET /api/v1/brands/:slug', () => {
    it('should return brand detail with lines', async () => {
      // First get brands
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/brands',
      })
      const brands = JSON.parse(listResponse.body)
      if (brands.length === 0) {
        console.log('No brands in database for testing')
        return
      }

      const slug = brands[0].slug

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/brands/${slug}`,
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('id')
      expect(body).toHaveProperty('name')
      expect(body).toHaveProperty('slug')
      expect(body).toHaveProperty('productCount')
      expect(body).toHaveProperty('lines')
      expect(Array.isArray(body.lines)).toBe(true)
      expect(body).toHaveProperty('seo')
    })

    it('should return 404 for non-existent brand', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/brands/non-existent-brand',
      })

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('BRAND_NOT_FOUND')
    })
  })

  describe('GET /api/v1/lines', () => {
    it('should return list of lines', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/lines',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(Array.isArray(body)).toBe(true)
      if (body.length > 0) {
        expect(body[0]).toHaveProperty('id')
        expect(body[0]).toHaveProperty('name')
        expect(body[0]).toHaveProperty('slug')
        expect(body[0]).toHaveProperty('brand')
        expect(body[0]).toHaveProperty('productCount')
      }
    })

    it('should filter lines by brand', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/lines?brand=isseimi',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(Array.isArray(body)).toBe(true)
      // All lines should be from ISSEIMI brand
      for (const line of body) {
        expect(line.brand.slug).toBe('isseimi')
      }
    })
  })
})
