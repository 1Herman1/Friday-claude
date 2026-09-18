import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createUser, authHeader } from './factories'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * lastSeenAt обновляется fire-and-forget уже после ответа, поэтому проверка
 * ждёт появления отметки, а не читает базу сразу.
 */
async function waitForLastSeen(userId: string, timeoutMs = 5000): Promise<Date | null> {
  const prisma = getTestPrisma()
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastSeenAt: true },
    })
    if (u?.lastSeenAt) return u.lastSeenAt
    await sleep(50)
  }
  return null
}

describe.skipIf(!hasTestDb)('lastSeenAt при аутентификации (интеграционные)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    const { buildApp } = await import('../index')
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    if (app) await app.close()
    await closeTestPrisma()
  })

  beforeEach(async () => {
    await resetDb()
  })

  it('запрос гостевым токеном проставляет lastSeenAt', async () => {
    const prisma = getTestPrisma()
    const guest = await prisma.user.create({
      data: {
        name: 'Гость',
        welcomeBonusGranted: true,
        createdAt: new Date(Date.now() - 40 * 86400000),
        lastSeenAt: null,
      },
    })
    const token = app.jwt.sign({ userId: guest.id, role: 'customer', type: 'guest' })

    const res = await app.inject({
      method: 'GET',
      url: '/api/cart',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)

    const lastSeenAt = await waitForLastSeen(guest.id)
    expect(lastSeenAt).not.toBeNull()
    expect(Date.now() - lastSeenAt!.getTime()).toBeLessThan(60_000)
  })

  it('запрос зарегистрированного пользователя тоже проставляет lastSeenAt (регрессия)', async () => {
    const prisma = getTestPrisma()
    const user = await createUser({ name: 'Покупатель' })
    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: null } })

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: authHeader(app, user.id),
    })

    expect(res.statusCode).toBe(200)

    const lastSeenAt = await waitForLastSeen(user.id)
    expect(lastSeenAt).not.toBeNull()
  })

  it('токен удалённого гостя не роняет запрос в 500', async () => {
    const prisma = getTestPrisma()
    const guest = await prisma.user.create({
      data: { name: 'Гость', welcomeBonusGranted: true },
    })
    const token = app.jwt.sign({ userId: guest.id, role: 'customer', type: 'guest' })

    await prisma.user.delete({ where: { id: guest.id } })

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { code: '000000' },
    })

    // гостю удаление аккаунта запрещено — важно, что это 403, а не 500 от
    // попытки записать lastSeenAt в несуществующую строку
    expect(res.statusCode).toBe(403)

    // дать fire-and-forget обновлению завершиться и убедиться, что оно тихое
    await sleep(300)
    const stillGone = await prisma.user.findUnique({ where: { id: guest.id } })
    expect(stillGone).toBeNull()
  })
})
