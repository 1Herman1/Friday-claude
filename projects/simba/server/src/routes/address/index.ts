import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { suggestAddress } from '../../services/address/dadata.js'
import { checkRateLimit } from '../../lib/rate-limit.js'

const suggestSchema = z.object({
  query: z.string().trim().min(3).max(200),
})

export default async function addressRoutes(app: FastifyInstance) {
  // POST /api/address/suggest — получить подсказки адреса
  app.post('/suggest', async (req, reply) => {
    const clientIp = req.ip

    if (!checkRateLimit(clientIp, 'suggest')) {
      return reply.status(429).send({
        error: 'Слишком много запросов. Попробуйте позже',
      })
    }

    const result = suggestSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(400).send({
        error: 'Некорректный запрос',
      })
    }

    const { query } = result.data

    try {
      const suggestions = await suggestAddress(query)
      return reply.send({ suggestions })
    } catch (err) {
      if (err instanceof Error && err.message === 'not configured') {
        return reply.status(503).send({
          error: 'Подсказки адреса не подключены',
        })
      }

      app.log.error(err)
      return reply.status(502).send({
        error: 'Не удалось получить подсказки',
      })
    }
  })
}
