import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { checkRateLimit } from '../../lib/rate-limit'
import { checkPromoCode } from '../../services/promo.service'

export default async function promoRoutes(app: FastifyInstance) {
  app.post<{ Body: { code: string; subtotal: number } }>(
    '/validate',
    {
      preHandler: app.authenticateOptional,
    },
    async (request, reply) => {
      const ip = request.ip || 'unknown'
      if (!checkRateLimit(ip, 'promo')) {
        return reply.code(429).send({ error: 'Слишком много попыток, подождите минуту' })
      }

      const schema = z.object({
        code: z.string().trim().min(1).max(40),
        subtotal: z.number().int().min(0),
      })

      const parsed = schema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Некорректные параметры' })
      }
      const body = parsed.data

      const uid = request.user?.userId
      const check = await checkPromoCode(app.prisma, body.code, body.subtotal, uid)

      if (!check.ok) {
        return reply.code(200).send({ valid: false, reason: check.reason })
      }

      return reply.code(200).send({
        valid: true,
        code: check.promo.code,
        type: check.promo.type,
        value: check.promo.value,
        minSubtotal: check.promo.minSubtotal,
        discount: check.discount,
      })
    }
  )
}
