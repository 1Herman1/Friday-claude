import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { postService } from '../../services/post.service.js'
import { ApiError } from '../../lib/errors.js'

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(60).optional().default(12),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

const slugSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,100}$/),
})

export default async function postsRoutes(app: FastifyInstance) {
  // GET /api/v1/posts - list published posts only
  app.get(
    '/posts',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 60 },
            offset: { type: 'integer', minimum: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['items', 'total', 'limit', 'offset'],
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    slug: { type: 'string' },
                    title: { type: 'string' },
                    excerpt: { type: 'string', nullable: true },
                    publishedAt: { type: 'string' },
                    createdAt: { type: 'string' },
                  },
                },
              },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
            },
          },
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
        published: true,
        isActive: true,
        limit: result.data.limit,
        offset: result.data.offset,
      })

      reply.code(200)
      return data
    }
  )

  // GET /api/v1/posts/:slug - get published post by slug with embedded products
  app.get(
    '/posts/:slug',
    {
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

      const post = await postService.getPostBySlug(result.data.slug, true)

      // Extract and fetch embedded products
      const productSlugs = postService.extractProductSlugs(post.body)
      const products = await postService.getProductsBySlug(productSlugs)

      reply.code(200)
      return {
        ...post,
        products,
      }
    }
  )
}
