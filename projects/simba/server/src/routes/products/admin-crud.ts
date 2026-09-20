import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { checkRole } from '../../middleware/check-role'
import { QUIZ_TAGS } from '../../lib/quiz-tags'

const variantSchema = z.object({
  weight: z.number().positive(),
  price: z.number().int().positive(),
  oldPrice: z.number().int().positive().optional(),
  stock: z.number().int().min(0).default(0),
  sku: z.string().optional(),
})

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  brandId: z.string().uuid().optional(),
  images: z.array(z.string().max(500)).default([]),
  isGrainFree: z.boolean().default(false),
  isHypoallergenic: z.boolean().default(false),
  isWeightControl: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  protein: z.number().positive().optional(),
  fat: z.number().positive().optional(),
  fiber: z.number().positive().optional(),
  ash: z.number().positive().optional(),
  ingredients: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  categoryIds: z.array(z.string().uuid()).default([]),
  species: z.enum(['cat', 'dog', 'both', 'unknown']).optional(),
  quizTags: z.array(z.enum(QUIZ_TAGS)).default([]),
  showAboutTab: z.boolean().default(true),
  showSpecsTab: z.boolean().default(true),
  showReviewsTab: z.boolean().default(true),
  variants: z.array(variantSchema).min(1),
})

const updateSchema = createSchema.partial()

// Поле species и тег species:* в quizTags дублируются намеренно (schema.prisma:364):
// поле фильтрует каталог, тег обслуживает подбор. Меняем одно — приводим второе.
function syncSpeciesTag(quizTags: string[], species?: string | null): string[] {
  const filtered = quizTags.filter(tag => !tag.startsWith('species:'))
  if (!species || species === 'unknown' || species === 'both') return filtered
  // cat или dog → добавляем species:cat или species:dog
  return [...filtered, `species:${species}`]
}

export default async function adminCrudRoute(app: FastifyInstance) {
  const adminGuard = { preHandler: [app.authenticate, checkRole(['super_admin', 'products_manager'])] }

  app.get<{ Querystring: { search?: string; status?: string; species?: string; page?: string; limit?: string } }>('/', adminGuard, async (request, reply) => {
    const querySchema = z.object({
      search: z.string().max(100).optional(),
      status: z.enum(['all', 'active', 'hidden']).default('all'),
      species: z.enum(['cat', 'dog', 'both', 'unknown']).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })

    const parsed = querySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message })
    }

    const { search, status, species, page, limit } = parsed.data

    const where: Prisma.ProductWhereInput = {}

    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }

    if (status === 'active') {
      where.isActive = true
    } else if (status === 'hidden') {
      where.isActive = false
    }

    if (species) {
      where.species = species
    }

    const items = await app.prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        species: true,
        isActive: true,
        hiddenManually: true,
        updatedAt: true,
        brand: { select: { name: true } },
        variants: { select: { price: true, isActive: true } },
      },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    })

    const total = await app.prisma.product.count({ where })
    const totalPages = Math.ceil(total / limit)

    return reply.send({
      items,
      total,
      page,
      totalPages,
    })
  })

  app.get<{ Params: { id: string } }>('/:id', adminGuard, async (request, reply) => {
    const { id } = request.params
    const product = await app.prisma.product.findUnique({
      where: { id },
      include: { variants: true, categories: true },
    })
    if (!product) {
      return reply.status(404).send({ error: 'Product not found' })
    }
    return reply.send(product)
  })

  app.post('/', adminGuard, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message })
    }

    const { categoryIds, variants, species, quizTags: rawQuizTags, ...data } = parsed.data
    const quizTags = syncSpeciesTag(rawQuizTags ?? [], species)

    const product = await app.prisma.product.create({
      data: {
        ...data,
        species: species ?? 'unknown',
        quizTags,
        categories: {
          create: categoryIds.map((categoryId) => ({ categoryId })),
        },
        variants: {
          create: variants,
        },
      },
      include: { variants: true, categories: true },
    })

    return reply.status(201).send(product)
  })

  app.put<{ Params: { id: string } }>('/:id', adminGuard, async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message })
    }

    const { id } = request.params
    const { categoryIds, variants, species, quizTags: rawQuizTags, ...data } = parsed.data

    const exists = await app.prisma.product.findUnique({ where: { id } })
    if (!exists) {
      return reply.status(404).send({ error: 'Product not found' })
    }

    // Синхронизируем при любом участии вида или тегов в запросе: вид без тегов —
    // поверх текущих тегов товара (иначе смена вида из формы стирала бы ручные
    // теги подбора), теги без вида — под текущим видом (иначе тег вида молча
    // терялся бы, а поле оставалось).
    const quizTags =
      species !== undefined || rawQuizTags !== undefined
        ? syncSpeciesTag(rawQuizTags ?? exists.quizTags, species ?? exists.species)
        : undefined

    const product = await app.prisma.$transaction(async (tx) => {
      if (categoryIds !== undefined) {
        await tx.productCategory.deleteMany({ where: { productId: id } })
      }
      if (variants !== undefined) {
        await tx.productVariant.deleteMany({ where: { productId: id } })
      }

      return tx.product.update({
        where: { id },
        data: {
          ...data,
          ...(species !== undefined && { species }),
          ...(quizTags !== undefined && { quizTags }),
          ...(categoryIds !== undefined && {
            categories: {
              create: categoryIds.map((categoryId) => ({ categoryId })),
            },
          }),
          ...(variants !== undefined && {
            variants: {
              create: variants,
            },
          }),
        },
        include: { variants: true, categories: true },
      })
    })

    return reply.send(product)
  })

  app.put<{ Params: { id: string } }>('/:id/visibility', adminGuard, async (request, reply) => {
    const visibilitySchema = z.object({
      isActive: z.boolean(),
    })

    const parsed = visibilitySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message })
    }

    const { id } = request.params
    const { isActive } = parsed.data

    const product = await app.prisma.product.findUnique({ where: { id } })
    if (!product) {
      return reply.status(404).send({ error: 'Товар не найден' })
    }

    const updated = await app.prisma.product.update({
      where: { id },
      data: {
        isActive,
        hiddenManually: !isActive,
      },
    })

    return reply.send(updated)
  })

  app.delete<{ Params: { id: string } }>('/:id', adminGuard, async (request, reply) => {
    const { id } = request.params

    const exists = await app.prisma.product.findUnique({ where: { id } })
    if (!exists) {
      return reply.status(404).send({ error: 'Product not found' })
    }

    await app.prisma.product.update({
      where: { id },
      data: { isActive: false, hiddenManually: true },
    })

    return reply.send({ success: true })
  })
}
