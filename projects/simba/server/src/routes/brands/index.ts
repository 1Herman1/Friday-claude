import { FastifyInstance } from 'fastify'

export default async function brandRoutes(app: FastifyInstance) {
  app.get('/', async (_request, reply) => {
    // Только бренды, у которых есть что купить: иначе плитка на главной ведёт
    // в пустой каталог. Счётчик отдаём наружу — им же сортируем витрину.
    const brands = await app.prisma.brand.findMany({
      where: { products: { some: { isActive: true } } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        accentColor: true,
        logoFit: true,
        _count: { select: { products: { where: { isActive: true } } } },
      },
    })
    return reply.send(
      brands.map(({ _count, ...brand }) => ({ ...brand, productCount: _count.products })),
    )
  })

  app.get<{ Params: { slug: string } }>('/:slug', async (request, reply) => {
    const brand = await app.prisma.brand.findUnique({
      where: { slug: request.params.slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        accentColor: true,
        logoFit: true,
        description: true,
      },
    })

    if (!brand) {
      return reply.status(404).send({ error: 'Brand not found' })
    }

    return reply.send(brand)
  })
}
