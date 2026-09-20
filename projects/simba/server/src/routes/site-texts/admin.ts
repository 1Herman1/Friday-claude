import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { checkRole } from '../../middleware/check-role'
import { SITE_TEXT_DEFAULTS } from '../../lib/site-text-defaults'

const valueSchema = z.object({ value: z.string().min(1).max(1000) })

const siteTextsAdminRoutes: FastifyPluginAsync = async (app) => {
  const guard = { preHandler: [app.authenticate, checkRole(['super_admin', 'products_manager'])] }

  app.get('/', guard, async () => {
    const rows = await app.prisma.siteText.findMany()
    const overrides = new Map(rows.map((r) => [r.key, r.value]))
    const items = Object.entries(SITE_TEXT_DEFAULTS).map(([key, d]) => ({
      key,
      label: d.label,
      group: d.group,
      defaultValue: d.value,
      value: overrides.get(key) ?? d.value,
      isOverridden: overrides.has(key),
    }))
    return { items }
  })

  app.put<{ Params: { key: string } }>('/:key', guard, async (request, reply) => {
    const key = request.params.key
    const def = SITE_TEXT_DEFAULTS[key]
    if (!def) return reply.status(404).send({ error: 'Такого текста нет' })
    const parsed = valueSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Текст от 1 до 1000 символов' })
    const row = await app.prisma.siteText.upsert({
      where: { key },
      create: { key, value: parsed.data.value, group: def.group, label: def.label },
      update: { value: parsed.data.value },
    })
    return { key, label: def.label, group: def.group, defaultValue: def.value, value: row.value, isOverridden: true }
  })

  app.post<{ Params: { key: string } }>('/reset/:key', guard, async (request, reply) => {
    const key = request.params.key
    const def = SITE_TEXT_DEFAULTS[key]
    if (!def) return reply.status(404).send({ error: 'Такого текста нет' })
    await app.prisma.siteText.deleteMany({ where: { key } })
    return { key, label: def.label, group: def.group, defaultValue: def.value, value: def.value, isOverridden: false }
  })
}

export default siteTextsAdminRoutes
