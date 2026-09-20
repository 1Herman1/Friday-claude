import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { postService } from '../../services/post.service.js'
import { db } from '../../lib/db.js'
import { ApiError } from '../../lib/errors.js'

const listPostsSchema = z.object({
  published: z.enum(['true', 'false']).optional().transform((v) => v === 'true' ? true : v === 'false' ? false : undefined),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9-]{1,100}$/),
  body: z.string().max(100_000),
  excerpt: z.string().max(500).nullable().optional(),
  coverImage: z.string().url().nullable().optional(),
  audience: z.enum(['public', 'retail']).default('public'),
  seoTitle: z.string().max(60).nullable().optional(),
  seoDescription: z.string().max(160).nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional().transform((v) => v ? new Date(v) : null),
})

const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().regex(/^[a-z0-9-]{1,100}$/).optional(),
  body: z.string().max(100_000).optional(),
  excerpt: z.string().max(500).nullable().optional(),
  coverImage: z.string().url().nullable().optional(),
  audience: z.enum(['public', 'retail']).optional(),
  seoTitle: z.string().max(60).nullable().optional(),
  seoDescription: z.string().max(160).nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional().transform((v) => v !== undefined ? (v ? new Date(v) : null) : undefined),
  isActive: z.boolean().optional(),
})

export async function postsRoutes(app: FastifyInstance, preHandlers: any[]) {
  // GET /api/v1/admin/posts - list all posts (including drafts)
  app.get<{ Querystring: any; Reply: any }>(
    '/posts',
    {
      preHandler: preHandlers,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            published: { type: 'string', enum: ['true', 'false'] },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
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
                    publishedAt: { type: 'string', nullable: true },
                    isActive: { type: 'boolean' },
                    createdAt: { type: 'string' },
                  },
                },
              },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
            },
          },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
      const result = listPostsSchema.safeParse(request.query)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const data = await postService.listPosts({
        published: result.data.published,
        isActive: true,
        limit: result.data.limit,
        offset: result.data.offset,
      })

      reply.code(200)
      return data
    }
  )

  // GET /api/v1/admin/posts/:id - get single post
  app.get<{ Params: { id: string }; Reply: any }>(
    '/posts/:id',
    {
      preHandler: preHandlers,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: { type: 'object' },
          404: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const found = await db.post.findFirst({
        where: { id: request.params.id, deletedAt: null },
      })

      if (!found) {
        throw new ApiError(404, 'NOT_FOUND', 'Статья не найдена')
      }

      reply.code(200)
      return found
    }
  )

  // POST /api/v1/admin/posts - create new post
  app.post<{ Body: any; Reply: any }>(
    '/posts',
    {
      preHandler: preHandlers,
      schema: {
        body: {
          type: 'object',
          required: ['title', 'slug', 'body'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 200 },
            slug: { type: 'string', pattern: '^[a-z0-9-]{1,100}$' },
            body: { type: 'string', maxLength: 100_000 },
            excerpt: { type: 'string', maxLength: 500 },
            coverImage: { type: 'string', format: 'uri' },
            audience: { type: 'string', enum: ['public', 'retail'] },
            seoTitle: { type: 'string', maxLength: 60 },
            seoDescription: { type: 'string', maxLength: 160 },
            publishedAt: { type: 'string', format: 'date-time' },
          },
        },
        response: {
          201: { type: 'object' },
          400: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      const result = createPostSchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const post = await postService.createPost(result.data)

      reply.code(201)
      return post
    }
  )

  // PATCH /api/v1/admin/posts/:id - update post
  app.patch<{ Params: { id: string }; Body: any; Reply: any }>(
    '/posts/:id',
    {
      preHandler: preHandlers,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 200 },
            slug: { type: 'string', pattern: '^[a-z0-9-]{1,100}$' },
            body: { type: 'string', maxLength: 100_000 },
            excerpt: { type: 'string', maxLength: 500 },
            coverImage: { type: 'string', format: 'uri' },
            audience: { type: 'string', enum: ['public', 'retail'] },
            seoTitle: { type: 'string', maxLength: 60 },
            seoDescription: { type: 'string', maxLength: 160 },
            publishedAt: { type: 'string', format: 'date-time' },
            isActive: { type: 'boolean' },
          },
        },
        response: {
          200: { type: 'object' },
          400: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const result = updatePostSchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const post = await postService.updatePost(request.params.id, result.data)

      reply.code(200)
      return post
    }
  )

  // DELETE /api/v1/admin/posts/:id - soft delete post
  app.delete<{ Params: { id: string }; Reply: any }>(
    '/posts/:id',
    {
      preHandler: preHandlers,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          204: { type: 'null' },
          404: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await postService.deletePost(request.params.id)
      reply.code(204)
      return null
    }
  )
}
