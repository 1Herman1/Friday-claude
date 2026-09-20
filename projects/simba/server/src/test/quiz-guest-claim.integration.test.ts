import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createUser, createProductWithVariant, authHeader } from './factories'

const dogAnswers = {
  species: 'dog',
  age: 'adult',
  size: 'medium',
  activity: 'normal',
  weight: 'normal',
  health: ['none'],
  avoid: [],
  format: 'dry',
  flavor: 'any',
  philosophy: 'any',
  brand: 'any',
}

/**
 * Сценарий «прошёл подбор гостем → вошёл → забрал бонус». Раньше роут /match
 * отдавал сервису гостевой userId, сессия привязывалась к гостю, и claim после
 * входа отбивал её как чужую (409). Проверяем через роуты, а не сервис: баг
 * жил именно на границе.
 */
describe.skipIf(!hasTestDb)('Бонус за подбор у гостя (интеграционные)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    const { buildApp } = await import('../index')
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await closeTestPrisma()
  })

  beforeEach(async () => {
    await resetDb()
    const { product } = await createProductWithVariant({ species: 'dog', name: 'Корм для собак' })
    await getTestPrisma().product.update({
      where: { id: product.id },
      data: { quizTags: ['species:dog', 'age:adult', 'size:medium', 'format:dry'] },
    })
  })

  it('гостевая сессия подбора остаётся ничьей, а после входа claim начисляет 300', async () => {
    const guest = await app.inject({ method: 'POST', url: '/api/auth/guest-session', remoteAddress: '10.9.9.1' })
    expect(guest.statusCode).toBe(200)
    const guestHeaders = { authorization: `Bearer ${guest.json().token}` }

    const match = await app.inject({
      method: 'POST',
      url: '/api/quiz/match',
      headers: guestHeaders,
      payload: dogAnswers,
    })
    expect(match.statusCode).toBe(200)
    expect(match.json().bonus.status).toBe('guest')

    const sessionId: string = match.json().sessionId
    const session = await getTestPrisma().quizSession.findUnique({ where: { id: sessionId } })
    expect(session?.userId).toBeNull()

    const user = await createUser()
    const claim = await app.inject({
      method: 'POST',
      url: '/api/quiz/claim',
      headers: authHeader(app, user.id),
      payload: { sessionId },
    })
    expect(claim.statusCode).toBe(200)
    expect(claim.json()).toMatchObject({ granted: true, amount: 300 })

    const fresh = await getTestPrisma().user.findUnique({ where: { id: user.id } })
    expect(fresh?.bonusPoints).toBe(300)
  })
})
