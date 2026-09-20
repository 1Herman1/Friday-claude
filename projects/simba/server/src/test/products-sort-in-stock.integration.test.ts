import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from './setup'
import { createProductWithVariant } from './factories'

describe.skipIf(!hasTestDb)('Сортировка каталога по наличию', () => {
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
    // Создаём товары: в наличии, без наличия, в наличии
    await createProductWithVariant({ name: 'Корм A в наличии', stock: 10 })
    await createProductWithVariant({ name: 'Корм B нет', stock: 0 })
    await createProductWithVariant({ name: 'Корм C в наличии', stock: 5 })
    await getTestPrisma().product.updateMany({ data: { isActive: true } })
  })

  async function names(query: string) {
    const res = await app.inject({ method: 'GET', url: `/api/products/list${query}` })
    expect(res.statusCode).toBe(200)
    return (res.json().items as { name: string }[]).map((p) => p.name)
  }

  it('sort=in_stock возвращает товары в наличии перед теми что нет', async () => {
    const result = await names('?sort=in_stock')
    // Товары в наличии должны быть первыми, затем без наличия
    const inStockCount = result.filter((n) => n.includes('в наличии')).length
    expect(inStockCount).toBe(2)
    // Товары в наличии должны идти перед товарами без наличия
    const firstOutOfStock = result.findIndex((n) => n.includes('нет'))
    const lastInStock = result.findLastIndex((n) => n.includes('в наличии'))
    expect(lastInStock).toBeLessThan(firstOutOfStock)
  })
})
