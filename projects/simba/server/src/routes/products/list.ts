import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getProducts } from '../../services/product.service'

/// Пустой параметр (?species=) — это «фильтр не выбран», а не ошибка. Без этого
/// каталог отвечал 400 на собственный же адрес с очищенным фильтром.
const blankToUndefined = (value: unknown) => (value === '' ? undefined : value)

const querySchema = z.object({
  category: z.string().optional(),
  brand: z.string().optional(),
  filters: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  search: z.string().optional(),
  format: z.preprocess(blankToUndefined, z.enum(['dry', 'wet']).optional()),
  species: z.preprocess(blankToUndefined, z.enum(['cat', 'dog']).optional()),
  purpose: z.preprocess(blankToUndefined, z.enum(['medical']).optional()),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  sort: z.preprocess(blankToUndefined, z.enum(['price_asc', 'price_desc', 'newest', 'popular', 'in_stock']).optional()),
  featured: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export default async function listRoute(app: FastifyInstance) {
  app.get('/list', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message })
    }

    const q = parsed.data

    const filterValueIds = q.filters
      ? q.filters.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined

    const result = await getProducts(app.prisma, {
      categorySlug: q.category,
      brandSlug: q.brand,
      filterValueIds,
      minPrice: q.minPrice !== undefined ? q.minPrice * 100 : undefined,
      maxPrice: q.maxPrice !== undefined ? q.maxPrice * 100 : undefined,
      search: q.search,
      format: q.format,
      species: q.species,
      purpose: q.purpose,
      tags: q.tags === undefined ? undefined : Array.isArray(q.tags) ? q.tags : [q.tags],
      sortBy: q.sort,
      featured: q.featured === 'true',
      page: q.page,
      limit: q.limit,
    })

    return reply.send(result)
  })
}
