import { FastifyInstance } from 'fastify'

interface CategoryNode {
  id: string
  name: string
  slug: string
  image: string | null
  kind: string | null
  species: string | null
  children: CategoryNode[]
}

export default async function treeRoute(app: FastifyInstance) {
  app.get('/tree', async (_request, reply) => {
    const categories = await app.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        parentId: true,
        kind: true,
        species: true,
      },
    })

    const map = new Map<string, CategoryNode>()
    const roots: CategoryNode[] = []

    for (const cat of categories) {
      map.set(cat.id, { ...cat, children: [] })
    }

    for (const cat of categories) {
      const node = map.get(cat.id)!
      if (cat.parentId && map.has(cat.parentId)) {
        map.get(cat.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    return reply.send(roots)
  })
}
