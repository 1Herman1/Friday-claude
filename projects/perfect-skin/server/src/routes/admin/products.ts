import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { mkdir, unlink } from 'fs/promises'
import { join, resolve, relative } from 'path'
import { randomUUID } from 'crypto'
import { adminProductService } from '../../services/admin-product.service.js'
import { ApiError } from '../../lib/errors.js'
import { sniffMime } from '../../lib/pro-docs.js'
import { productImagesDir } from '../../lib/env.js'
import { db } from '../../lib/db.js'
import { ProductDetailsSchema, ruErrorMap } from '../../lib/product-details.js'

const listVariantsSchema = z.object({
  search: z.string().max(100).optional(),
  isActive: z.enum(['true', 'false']).optional().transform((v) => v === 'true' ? true : v === 'false' ? false : undefined),
  lowStock: z.enum(['true', 'false']).optional().transform((v) => v === 'true' ? true : v === 'false' ? false : undefined),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

const updateVariantSchema = z.object({
  volumeLabel: z.string().max(200).optional(),
  sku: z.string().max(100).optional(),
  stock: z.number().int().min(0).optional(),
  retailPrice: z.number().int().min(1).optional(),
  wholesalePrice: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
  isProfessional: z.boolean().optional(),
})

const createVariantSchema = z.object({
  volumeValue: z.number().positive(),
  volumeUnit: z.enum(['ml', 'g', 'pcs']),
  volumeLabel: z.string().max(200).optional(),
  retailPrice: z.number().int().min(1),
  wholesalePrice: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0).optional(),
  sku: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
  isProfessional: z.boolean().optional(),
})

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug должен содержать только латиницу, цифры и дефисы'),
  shortDescription: z.string().max(500).optional(),
  description: z.string().min(1).max(20000),
  brandId: z.string().uuid().nullable().optional(),
  lineId: z.string().uuid().nullable().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  skinTypes: z.array(z.string()).optional(),
  concerns: z.array(z.string()).optional(),
  usage: z.string().max(10000).optional(),
  inciText: z.string().max(10000).optional(),
  seoTitle: z.string().max(300).optional(),
  seoDescription: z.string().max(300).optional(),
})

const updateProductFullSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  shortDescription: z.string().max(500).nullable().optional(),
  description: z.string().min(1).max(20000).optional(),
  brandId: z.string().uuid().nullable().optional(),
  lineId: z.string().uuid().nullable().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  skinTypes: z.array(z.string()).optional(),
  concerns: z.array(z.string()).optional(),
  usage: z.string().max(10000).nullable().optional(),
  inciText: z.string().max(10000).nullable().optional(),
  seoTitle: z.string().max(300).nullable().optional(),
  seoDescription: z.string().max(300).nullable().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isProfessional: z.boolean().optional(),
  details: ProductDetailsSchema.nullable().optional(),
})

const deleteImageSchema = z.object({
  url: z.string().startsWith('/uploads/products/').max(300),
})

const reorderImagesSchema = z.object({
  images: z.array(z.string().max(300)).max(50),
})

const updateProductSchema = z.object({
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isProfessional: z.boolean().optional(),
})

const setPopularSchema = z.object({
  productIds: z.array(z.string().uuid()).max(20),
})

export async function productsRoutes(app: FastifyInstance, preHandlers: any[]) {
  // GET /api/v1/admin/variants
  app.get<{ Querystring: any; Reply: any }>(
    '/variants',
    {
      preHandler: preHandlers,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string' },
            isActive: { type: 'string', enum: ['true', 'false'] },
            lowStock: { type: 'string', enum: ['true', 'false'] },
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
                items: { $ref: 'ps.adminVariant#' },
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
      const result = listVariantsSchema.safeParse(request.query)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const data = await adminProductService.listVariants({
        search: result.data.search,
        isActive: result.data.isActive,
        lowStock: result.data.lowStock,
        limit: result.data.limit,
        offset: result.data.offset,
      })

      reply.code(200)
      return data
    }
  )

  // PATCH /api/v1/admin/variants/:id
  app.patch<{ Params: { id: string }; Body: any; Reply: any }>(
    '/variants/:id',
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
        body: { type: 'object' },
        response: {
          200: { $ref: 'ps.adminVariant#' },
          400: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const result = updateVariantSchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const variant = await adminProductService.updateVariant(request.params.id, result.data)

      reply.code(200)
      return variant
    }
  )


  // GET /api/v1/admin/popular
  app.get<{ Reply: any }>(
    '/popular',
    {
      preHandler: preHandlers,
      schema: {
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'name', 'slug', 'image', 'minPrice', 'popularPin'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                slug: { type: 'string' },
                image: { type: ['string', 'null'] },
                minPrice: { type: 'integer' },
                popularPin: { type: 'integer' },
              },
            },
          },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const items = await adminProductService.getPopular()
      reply.code(200)
      return items
    }
  )

  // PUT /api/v1/admin/popular
  app.put<{ Body: any; Reply: any }>(
    '/popular',
    {
      preHandler: preHandlers,
      schema: {
        body: {
          type: 'object',
          required: ['productIds'],
          additionalProperties: false,
          properties: {
            productIds: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
              maxItems: 20,
            },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['success'],
            properties: {
              success: { type: 'boolean' },
            },
          },
          400: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      const result = setPopularSchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      await adminProductService.setPopular(result.data.productIds)
      reply.code(200)
      return { success: true }
    }
  )

  // GET /api/v1/admin/product-dictionaries
  app.get<{ Reply: any }>(
    '/product-dictionaries',
    {
      preHandler: preHandlers,
      schema: {
        response: {
          200: {
            type: 'object',
            required: ['brands', 'lines', 'categories'],
            properties: {
              brands: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                  },
                },
              },
              lines: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    brandId: { type: 'string' },
                    name: { type: 'string' },
                  },
                },
              },
              categories: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    slug: { type: 'string' },
                  },
                },
              },
            },
          },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const [brands, lines, categories] = await Promise.all([
        db.brand.findMany({
          where: { isActive: true, deletedAt: null },
          select: { id: true, name: true },
          orderBy: { sortOrder: 'asc' },
        }),
        db.productLine.findMany({
          where: { isActive: true, deletedAt: null },
          select: { id: true, brandId: true, name: true },
          orderBy: { sortOrder: 'asc' },
        }),
        db.category.findMany({
          where: { isActive: true, deletedAt: null },
          select: { id: true, name: true, slug: true },
          orderBy: { sortOrder: 'asc' },
        }),
      ])

      reply.code(200)
      return { brands, lines, categories }
    }
  )

  // GET /api/v1/admin/products/:id
  app.get<{ Params: { id: string }; Reply: any }>(
    '/products/:id',
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
          200: { type: 'object', additionalProperties: true },
          404: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const product = await adminProductService.getProduct(request.params.id)

      reply.code(200)
      return product
    }
  )

  // POST /api/v1/admin/products
  app.post<{ Body: any; Reply: any }>(
    '/products',
    {
      preHandler: preHandlers,
      schema: {
        body: {
          type: 'object',
          required: ['name', 'slug', 'description'],
        },
        response: {
          201: { type: 'object', additionalProperties: true },
          400: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      const result = createProductSchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const product = await adminProductService.createProduct(result.data)

      reply.code(201)
      return product
    }
  )

  // PATCH /api/v1/admin/products/:id (full edit)
  app.patch<{ Params: { id: string }; Body: any; Reply: any }>(
    '/products/:id',
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
        body: { type: 'object' },
        response: {
          200: { type: 'object', additionalProperties: true },
          400: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
          409: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const result = updateProductFullSchema.safeParse(request.body, { errorMap: ruErrorMap })
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации', {
          issues: result.error.issues.slice(0, 50).map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        })
      }

      const product = await adminProductService.updateProductFull(request.params.id, result.data)

      reply.code(200)
      return product
    }
  )

  // POST /api/v1/admin/products/:id/variants
  app.post<{ Params: { id: string }; Body: any; Reply: any }>(
    '/products/:id/variants',
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
          required: ['volumeValue', 'volumeUnit', 'retailPrice'],
        },
        response: {
          201: { $ref: 'ps.adminVariant#' },
          400: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const result = createVariantSchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const variant = await adminProductService.createVariant(request.params.id, result.data)

      reply.code(201)
      return variant
    }
  )

  // DELETE /api/v1/admin/variants/:id
  app.delete<{ Params: { id: string }; Reply: any }>(
    '/variants/:id',
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
      await adminProductService.deleteVariant(request.params.id)

      reply.code(204)
    }
  )

  // POST /api/v1/admin/products/:id/images (multipart)
  app.post<{ Params: { id: string }; Reply: any }>(
    '/products/:id/images',
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
          200: {
            type: 'object',
            required: ['url'],
            properties: {
              url: { type: 'string' },
            },
          },
          400: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const productId = request.params.id

      // Check product exists
      const product = await db.product.findUnique({
        where: { id: productId },
        select: { id: true, images: true },
      })
      if (!product) {
        throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Товар не найден')
      }

      const parts = request.parts()
      let fileBuffer: Buffer | null = null

      for await (const part of parts) {
        if (part.type === 'file') {
          const data = await part.toBuffer()
          fileBuffer = data
          break
        }
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        throw new ApiError(400, 'NO_FILE', 'Файл не загружен')
      }

      if (fileBuffer.length > 5 * 1024 * 1024) {
        throw new ApiError(400, 'FILE_TOO_LARGE', 'Файл не должен превышать 5 МБ')
      }

      let mime: string
      try {
        mime = sniffMime(fileBuffer)
      } catch {
        throw new ApiError(400, 'UNSUPPORTED_FILE', 'Допустимые форматы: JPEG, PNG, PDF')
      }

      if (!['image/jpeg', 'image/png'].includes(mime)) {
        throw new ApiError(400, 'UNSUPPORTED_FILE', 'Допустимые форматы: JPEG, PNG')
      }

      const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'bin'
      const filename = `${randomUUID()}.${ext}`

      try {
        await mkdir(productImagesDir, { recursive: true })
        const filepath = join(productImagesDir, filename)
        await (await import('fs/promises')).writeFile(filepath, fileBuffer)

        const url = `/uploads/products/${filename}`
        const updatedImages = [...product.images, url]

        await db.product.update({
          where: { id: productId },
          data: { images: updatedImages },
        })

        reply.code(200)
        return { url }
      } catch (err) {
        throw new ApiError(500, 'UPLOAD_ERROR', 'Ошибка при сохранении файла')
      }
    }
  )

  // DELETE /api/v1/admin/products/:id/images
  app.delete<{ Params: { id: string }; Body: any; Reply: any }>(
    '/products/:id/images',
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
          required: ['url'],
          additionalProperties: false,
          properties: {
            url: { type: 'string' },
          },
        },
        response: {
          204: { type: 'null' },
          400: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const result = deleteImageSchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const product = await db.product.findUnique({
        where: { id: request.params.id },
        select: { images: true },
      })
      if (!product) {
        throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Товар не найден')
      }

      const urlToDelete = result.data.url
      if (!product.images.includes(urlToDelete)) {
        throw new ApiError(404, 'IMAGE_NOT_FOUND', 'Изображение не найдено')
      }

      // Extract filename and validate it's from our directory
      if (urlToDelete.startsWith('/uploads/products/')) {
        const filename = urlToDelete.replace('/uploads/products/', '')
        // Security check: prevent directory traversal
        if (filename.includes('..') || filename.includes('/')) {
          throw new ApiError(400, 'INVALID_PATH', 'Недопустимое имя файла')
        }

        const filepath = join(productImagesDir, filename)
        const realPath = resolve(filepath)
        const dirPath = resolve(productImagesDir)

        if (!realPath.startsWith(dirPath)) {
          throw new ApiError(400, 'INVALID_PATH', 'Файл вне каталога продуктов')
        }

        try {
          await unlink(filepath)
        } catch {
          // Ignore if file doesn't exist
        }
      }

      const updatedImages = product.images.filter((img) => img !== urlToDelete)
      await db.product.update({
        where: { id: request.params.id },
        data: { images: updatedImages },
      })

      reply.code(204)
    }
  )

  // PATCH /api/v1/admin/products/:id/images/order
  app.patch<{ Params: { id: string }; Body: any; Reply: any }>(
    '/products/:id/images/order',
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
          required: ['images'],
          additionalProperties: false,
          properties: {
            images: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        response: {
          204: { type: 'null' },
          400: { $ref: 'ps.error#' },
          404: { $ref: 'ps.error#' },
          401: { $ref: 'ps.error#' },
          403: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const result = reorderImagesSchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Ошибка валидации')
      }

      const product = await db.product.findUnique({
        where: { id: request.params.id },
        select: { images: true },
      })
      if (!product) {
        throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Товар не найден')
      }

      // Verify all requested images exist
      const newImages = result.data.images
      const existingImages = new Set(product.images)

      for (const img of newImages) {
        if (!existingImages.has(img)) {
          throw new ApiError(400, 'IMAGE_NOT_FOUND', `Изображение не найдено: ${img}`)
        }
      }

      await db.product.update({
        where: { id: request.params.id },
        data: { images: newImages },
      })

      reply.code(204)
    }
  )
}
