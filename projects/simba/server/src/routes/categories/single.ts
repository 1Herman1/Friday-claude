import { FastifyInstance } from 'fastify'

export default async function singleRoute(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>('/:slug', async (request, reply) => {
    const { slug } = request.params

    const category = await app.prisma.category.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
        filters: {
          include: {
            filter: {
              select: {
                id: true,
                name: true,
                slug: true,
                type: true,
                values: {
                  select: {
                    id: true,
                    value: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!category) {
      return reply.status(404).send({ error: 'Category not found' })
    }

    return reply.send({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      seoTitle: category.seoTitle,
      seoDescription: category.seoDescription,
      filters: category.filters.map((cf) => ({
        id: cf.filter.id,
        name: cf.filter.name,
        slug: cf.filter.slug,
        type: cf.filter.type,
        values: cf.filter.values,
      })),
    })
  })
}
