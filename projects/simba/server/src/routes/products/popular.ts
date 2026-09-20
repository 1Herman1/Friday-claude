import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getPopularProducts } from '../../services/popular-products.service'

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(12).default(8),
})

export default async function popularRoute(app: FastifyInstance) {
  app.get('/popular', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message })
    }

    const { limit } = parsed.data

    const result = await getPopularProducts(app.prisma, limit)

    return reply.send(result)
  })
}
