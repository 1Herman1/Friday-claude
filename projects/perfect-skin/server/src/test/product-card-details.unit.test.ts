import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import { registerCommonSchemas } from '../schemas/common.js'
import { ProductDetailsSchema, type ProductDetails } from '../lib/product-details.js'

const full: ProductDetails = {
  v: 1,
  tagline: ['Короткое описание'],
  intro: ['Вступление.', 'Второй абзац.'],
  extra: [{ heading: 'Дополнение', paragraphs: ['Текст.'], items: ['пункт'] }],
  howItWorks: {
    heading: 'Как работает формула',
    lead: ['Вводный абзац.'],
    items: [
      { title: 'Пептиды', text: 'уплотняют кожу.' },
      { title: null, text: 'без заголовка.' },
    ],
    result: 'Итог.',
  },
  actives: ['EGF 0,001%'],
  forWhom: { lead: 'Подойдёт', items: ['Всем'], note: ['Примечание'] },
  usage: {
    heading: 'СПОСОБ ПРИМЕНЕНИЯ',
    steps: [
      { title: 'Утром', text: 'нанести.' },
      { title: null, text: 'не смывать.' },
    ],
    notes: ['Осторожно.'],
  },
  lifehack: { title: 'Лайфхак', paragraphs: ['Совет.'] },
  pro: {
    volumeLabel: '500 мл',
    tagline: ['Кабинет'],
    intro: ['Кабинетный абзац.'],
    howItWorks: { heading: 'Механизм', lead: [], items: [{ title: null, text: 'текст' }], result: null },
    forWhom: { lead: null, items: ['Специалистам'], note: [] },
    actives: ['Актив'],
    usage: { heading: 'ПРОТОКОЛ', steps: [{ title: null, text: 'по протоколу' }], notes: [] },
  },
}

function productCard(details: ProductDetails | null) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'test-product',
    name: 'Тестовый товар',
    brand: null,
    line: null,
    image: null,
    skinTypes: [],
    needs: [],
    minPrice: 100000,
    oldPrice: null,
    inStock: true,
    isProfessional: false,
    priceHidden: false,
    variants: [],
    images: [],
    shortDescription: null,
    description: 'Текст.',
    details,
    usage: null,
    inciText: null,
    ingredients: [],
    categories: [],
    seo: { title: null, description: null },
  }
}

async function serializeCard(details: ProductDetails | null): Promise<unknown> {
  const app = Fastify()
  registerCommonSchemas(app)
  app.get('/card', { schema: { response: { 200: { $ref: 'ps.productCardFull#' } } } }, async () => productCard(details))
  await app.ready()
  const res = await app.inject({ method: 'GET', url: '/card' })
  await app.close()
  return res.json<{ details: unknown }>().details
}

describe('ps.productCardFull: details', () => {
  it('полностью заполненная карточка проходит сериализацию без потерь', async () => {
    expect(ProductDetailsSchema.safeParse(full).success).toBe(true)
    expect(await serializeCard(full)).toEqual(full)
  })

  it('отсутствие карточки отдаётся как null', async () => {
    expect(await serializeCard(null)).toBeNull()
  })
})
