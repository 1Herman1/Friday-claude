import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { checkRole } from '../../middleware/check-role'

const slugSchema = z.string().regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')

const createSchema = z.object({
  name: z.string().min(1),
  slug: slugSchema,
  description: z.string().optional(),
  image: z.string().max(500).optional(),
  parentId: z.string().uuid().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  sortOrder: z.number().int().default(0),
})

const updateSchema = createSchema.partial()

interface CategoryNode {
  id: string
  name: string
  slug: string
  parentId: string | null
  sortOrder: number
  isActive: boolean
  productCount: number
  children: CategoryNode[]
}

async function hasCycle(prisma: any, categoryId: string, newParentId: string | null): Promise<boolean> {
  if (!newParentId) return false
  if (categoryId === newParentId) return true

  let current = newParentId
  const visited = new Set<string>()

  while (current) {
    // Поднимаемся к корню: если по пути встретили саму категорию —
    // новый родитель является её потомком, получится кольцо.
    if (current === categoryId || visited.has(current)) return true
    visited.add(current)

    const parent = await prisma.category.findUnique({
      where: { id: current },
      select: { parentId: true },
    })

    current = parent?.parentId ?? null
  }

  return false
}

export default async function adminCrudRoute(app: FastifyInstance) {
  const adminGuard = { preHandler: [app.authenticate, checkRole(['super_admin', 'products_manager'])] }

  app.get('/', adminGuard, async (_request, reply) => {
    const categories = await app.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        sortOrder: true,
        isActive: true,
        _count: { select: { products: true } },
      },
    })

    const map = new Map<string, CategoryNode>()
    const roots: CategoryNode[] = []

    for (const cat of categories) {
      map.set(cat.id, {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        parentId: cat.parentId,
        sortOrder: cat.sortOrder,
        isActive: cat.isActive,
        productCount: cat._count.products,
        children: [],
      })
    }

    for (const cat of categories) {
      const node = map.get(cat.id)!
      if (cat.parentId && map.has(cat.parentId)) {
        map.get(cat.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    return reply.send({ items: roots })
  })

  app.post('/', adminGuard, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message })
    }

    try {
      const category = await app.prisma.category.create({ data: parsed.data })
      return reply.status(201).send(category)
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return reply.status(400).send({ error: 'Slug already exists' })
      }
      throw err
    }
  })

  app.put<{ Params: { id: string } }>('/:id', adminGuard, async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message })
    }

    const { id } = request.params
    const data = parsed.data as any

    const exists = await app.prisma.category.findUnique({ where: { id } })
    if (!exists) {
      return reply.status(404).send({ error: 'Category not found' })
    }

    if (data.parentId !== undefined && (await hasCycle(app.prisma, id, data.parentId))) {
      return reply.status(400).send({ error: 'Cannot create cycle in category tree' })
    }

    try {
      const category = await app.prisma.category.update({
        where: { id },
        data,
      })
      return reply.send(category)
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return reply.status(400).send({ error: 'Slug already exists' })
      }
      throw err
    }
  })

  app.put<{ Body: { items: { id: string; parentId: string | null; sortOrder: number }[] } }>(
    '/reorder',
    adminGuard,
    async (request, reply) => {
      const items = request.body?.items ?? []

      if (!Array.isArray(items)) {
        return reply.status(400).send({ error: 'Body must contain items array' })
      }

      for (const item of items) {
        if (!item.id || typeof item.sortOrder !== 'number') {
          return reply.status(400).send({ error: 'Each item must have id and sortOrder' })
        }
      }

      for (const item of items) {
        if (await hasCycle(app.prisma, item.id, item.parentId ?? null)) {
          return reply.status(400).send({ error: `Cannot create cycle: category ${item.id}` })
        }
      }

      try {
        await app.prisma.$transaction(
          items.map((item) =>
            app.prisma.category.update({
              where: { id: item.id },
              data: {
                parentId: item.parentId,
                sortOrder: item.sortOrder,
              },
            })
          )
        )
        return reply.send({ success: true })
      } catch (err: any) {
        if (err?.code === 'P2025') {
          return reply.status(404).send({ error: 'One or more categories not found' })
        }
        throw err
      }
    }
  )

  app.delete<{ Params: { id: string } }>('/:id', adminGuard, async (request, reply) => {
    const { id } = request.params

    const exists = await app.prisma.category.findUnique({ where: { id } })
    if (!exists) {
      return reply.status(404).send({ error: 'Category not found' })
    }

    await app.prisma.category.update({
      where: { id },
      data: { isActive: false },
    })

    return reply.send({ success: true })
  })
}
