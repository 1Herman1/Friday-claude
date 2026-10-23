import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { postService } from '../../services/post.service.js'
import { ApiError } from '../../lib/errors.js'
import { viewerFromRequest } from '../../lib/pricing.js'
import { extractProductSlugs } from '../../lib/post-body.js'

const listSchema = z.object({
  kind: z.enum(['article', 'news']).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional().default(12),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

const slugSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,100}$/),
})

export default async function postsRoutes(app: FastifyInstance) {
  // GET /api/v1/posts - опубликованные материалы без тела
  app.get(
    '/posts',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        querystring: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['article', 'news'] },
            limit: { type: 'integer', minimum: 1, maximum: 60 },
            offset: { type: 'integer', minimum: 0 },
          },
        },
        response: {
          200: { $ref: 'ps.postList#' },
          400: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      const result = listSchema.safeParse(request.query)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const data = await postService.listPosts({
        publicOnly: true,
        kind: result.data.kind,
        limit: result.data.limit,
        offset: result.data.offset,
      })

      reply.header('Cache-Control', 'public, max-age=60')
      reply.code(200)
      return data
    }
  )

  // GET /api/v1/posts/:slug - опубликованная статья с товарами; без кэша
  app.get(
    '/posts/:slug',
    {
      // Товары в статье показываются с учётом того, кто читает.
      preHandler: app.authenticateOptional,
      schema: {
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string', pattern: '^[a-z0-9-]{1,100}$' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              slug: { type: 'string' },
              title: { type: 'string' },
              body: { type: 'string' },
              excerpt: { type: 'string', nullable: true },
              coverImage: { type: 'string', nullable: true },
              kind: { type: 'string', enum: ['article', 'news'] },
              isAd: { type: 'boolean' },
              advertiser: { type: ['string', 'null'] },
              erid: { type: ['string', 'null'] },
              publishedAt: { type: 'string' },
              createdAt: { type: 'string' },
              products: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['id', 'slug', 'name', 'minPrice'],
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    slug: { type: 'string' },
                    name: { type: 'string' },
                    brand: {
                      type: ['object', 'null'],
                      additionalProperties: false,
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        slug: { type: 'string' },
                      },
                    },
                    image: { type: ['string', 'null'] },
                    minPrice: { type: ['integer', 'null'] },
                  },
                },
              },
            },
          },
          404: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      const result = slugSchema.safeParse(request.params)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const post = await postService.getPublicPostBySlug(result.data.slug)
      const products = await postService.getProductsBySlug(extractProductSlugs(post.body), viewerFromRequest(request))

      reply.code(200)
      return {
        ...post,
        products,
      }
    }
  )
}
