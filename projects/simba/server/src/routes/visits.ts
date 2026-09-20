import { FastifyInstance } from 'fastify'
import { checkRateLimit } from '../lib/rate-limit'
import { mskDayAsDate } from '../lib/msk-time'

/** Счётчик посещений по дням: клиент шлёт один пинг в сутки на браузер. Сутки — московские (UTC+3). */
export default async function visitsRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    if (!checkRateLimit(request.ip, 'visits')) return reply.status(429).send()
    const now = new Date()
    const day = mskDayAsDate(now)
    await app.prisma.siteVisit.upsert({
      where: { day },
      create: { day, count: 1 },
      update: { count: { increment: 1 } },
    })
    return reply.status(204).send()
  })
}
