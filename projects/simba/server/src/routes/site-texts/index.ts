import { FastifyInstance } from 'fastify'

/** Переопределённые тексты сайта: клиент накладывает их на свои значения по умолчанию. */
export default async function siteTextsRoutes(app: FastifyInstance) {
  app.get('/', async (_request, reply) => {
    const rows = await app.prisma.siteText.findMany({ select: { key: true, value: true } })
    const texts: Record<string, string> = {}
    for (const row of rows) texts[row.key] = row.value
    reply.header('Cache-Control', 'public, max-age=60')
    return { texts }
  })
}
