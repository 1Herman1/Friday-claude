import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createProductWithVariant } from './factories'

describe.skipIf(!hasTestDb)('Фильтр каталога по виду животного', () => {
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
    await createProductWithVariant({ name: 'Корм для кошек', species: 'cat' })
    await createProductWithVariant({ name: 'Корм для собак', species: 'dog' })
    await createProductWithVariant({ name: 'Миска универсальная', species: 'both' })
    await createProductWithVariant({ name: 'Товар без разметки', species: 'unknown' })
    await getTestPrisma().product.updateMany({ data: { isActive: true } })
  })

  async function names(query: string) {
    const res = await app.inject({ method: 'GET', url: `/api/products/list${query}` })
    expect(res.statusCode).toBe(200)
    return (res.json().items as { name: string }[]).map((p) => p.name).sort()
  }

  it('в выдачу для кошек попадают кошачьи и универсальные товары', async () => {
    expect(await names('?species=cat')).toEqual(['Корм для кошек', 'Миска универсальная'])
  })

  it('корм для кошек не показывается в выдаче для собак', async () => {
    expect(await names('?species=dog')).toEqual(['Корм для собак', 'Миска универсальная'])
  })

  it('неразмеченный товар не попадает ни в одну видовую выдачу', async () => {
    expect(await names('?species=cat')).not.toContain('Товар без разметки')
    expect(await names('?species=dog')).not.toContain('Товар без разметки')
    expect(await names('')).toContain('Товар без разметки')
  })

  it('пустой параметр species — это отсутствие фильтра, а не ошибка', async () => {
    expect((await names('?species=')).length).toBe(4)
  })
})
