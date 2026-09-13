import { FastifyInstance } from 'fastify'
import { z } from 'zod'

const querySchema = z.object({
  page: z.enum(['home', 'catalog', 'about', 'other']).optional(),
  position: z.enum(['main_slider', 'promo_strip', 'sidebar']).optional(),
})

export default async function bannersRoute(app: FastifyInstance) {
  app.get(
    '/',
    async (request, reply) => {
      const parsed = querySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters' })
      }

      const { page, position } = parsed.data

      const where: Record<string, unknown> = { isActive: true }
      if (page) where.page = page
      if (position) where.position = position

      const banners = await app.prisma.banner.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          title: true,
          subtitle: true,
          image: true,
          imageMobile: true,
          showText: true,
          link: true,
          buttonText: true,
          page: true,
          position: true,
        },
      })

      return reply.send(banners)
    },
  )
}
