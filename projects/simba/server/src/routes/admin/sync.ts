import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { checkRole } from '../../middleware/check-role'
import { runMoyskladSyncTracked } from '../../services/moysklad/run'
import { startRun, SyncAlreadyRunningError } from '../../services/moysklad/history'

const bodySchema = z.object({
  dryRun: z.boolean().default(true),
})

const syncRoutes: FastifyPluginAsync = async (app) => {
  const guard = { preHandler: [app.authenticate, checkRole(['super_admin', 'products_manager'])] }

  // Запуск. Отвечаем сразу: прогон идёт минуты, а nginx рвёт соединение на 60 секундах.
  app.post('/moysklad', guard, async (request, reply) => {
    const result = bodySchema.safeParse(request.body ?? {})
    if (!result.success) {
      return reply.status(400).send({ error: 'Неверные параметры запуска' })
    }

    const apply = !result.data.dryRun

    // Слот занимаем ЗДЕСЬ, до ответа: иначе пришлось бы угадывать id только что
    // созданной записи и можно вернуть клиенту чужой, предыдущий прогон.
    let runId: string
    try {
      runId = await startRun(app.prisma, 'admin', !apply)
    } catch (err) {
      if (err instanceof SyncAlreadyRunningError) {
        return reply.status(409).send({ error: err.message, runId: err.runId })
      }
      throw err
    }

    // Прогон идёт минуты — не ждём его, клиент опрашивает GET /:id.
    runMoyskladSyncTracked({
      prisma: app.prisma,
      apply,
      force: false,
      trigger: 'admin',
      runId,
    }).catch((err) => {
      app.log.error({ err }, 'Синхронизация с МойСклад завершилась ошибкой')
    })

    return reply.status(202).send({ runId })
  })

  app.get('/moysklad', guard, async () => {
    const [last, lastSuccess, history] = await Promise.all([
      app.prisma.syncRun.findFirst({
        where: { source: 'moysklad' },
        orderBy: { startedAt: 'desc' },
      }),
      app.prisma.syncRun.findFirst({
        where: { status: 'success', dryRun: false, source: 'moysklad' },
        orderBy: { startedAt: 'desc' },
      }),
      app.prisma.syncRun.findMany({
        where: { source: 'moysklad' },
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
    ])

    return { last, lastSuccess, history }
  })

  app.get('/moysklad/:id', guard, async (request, reply) => {
    const { id } = request.params as { id: string }
    const run = await app.prisma.syncRun.findUnique({ where: { id } })

    if (!run) return reply.status(404).send({ error: 'Прогон не найден' })
    if (run.source !== 'moysklad') return reply.status(404).send({ error: 'Прогон не найден' })
    return run
  })
}

export default syncRoutes
