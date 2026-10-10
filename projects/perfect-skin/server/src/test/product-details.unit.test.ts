import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  ProductDetailsSchema,
  flattenDetails,
  readDetails,
  type ProductDetails,
} from '../lib/product-details.js'

const base = (): ProductDetails => ({
  v: 1,
  tagline: ['Короткое описание'],
  intro: ['Описание средства в одном абзаце.'],
  extra: [],
  howItWorks: {
    heading: 'Как работает формула',
    lead: [],
    items: [
      { title: 'Пептидный комплекс', text: 'уплотняет кожу.' },
      { title: null, text: 'без заголовка.' },
    ],
    result: null,
  },
  actives: ['EGF'],
  forWhom: { lead: null, items: ['Всем типам кожи'], note: [] },
  usage: {
    heading: 'СПОСОБ ПРИМЕНЕНИЯ',
    steps: [
      { title: 'Утром', text: 'нанести на чистую кожу.' },
      { title: null, text: 'Не смывать.' },
    ],
    notes: ['Примечание'],
  },
  lifehack: { title: 'Лайфхак от экспертов', paragraphs: ['Совет первый.', 'Совет второй.'] },
  pro: null,
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ProductDetailsSchema', () => {
  it('принимает полную карточку', () => {
    expect(ProductDetailsSchema.safeParse(base()).success).toBe(true)
  })

  it('отвергает лишние ключи на любом уровне', () => {
    const top = { ...base(), unknown: 1 }
    expect(ProductDetailsSchema.safeParse(top).success).toBe(false)

    const nested = base()
    nested.usage = { ...nested.usage!, extra: 'x' } as unknown as ProductDetails['usage']
    expect(ProductDetailsSchema.safeParse(nested).success).toBe(false)
  })

  it('отвергает пустую карточку: нет вступления, «Как работает» и «Кому подойдёт»', () => {
    const empty = { ...base(), intro: [], howItWorks: null, forWhom: null }
    const result = ProductDetailsSchema.safeParse(empty)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('пустая карточка')
  })

  it('принимает карточку, где есть только вступление', () => {
    const minimal = { ...base(), howItWorks: null, forWhom: null, usage: null, lifehack: null }
    expect(ProductDetailsSchema.safeParse(minimal).success).toBe(true)
  })

  it('не принимает пустую строку в тексте', () => {
    const broken = { ...base(), actives: ['   '] }
    expect(ProductDetailsSchema.safeParse(broken).success).toBe(false)
  })
})

describe('flattenDetails', () => {
  it('собирает описание и применение, пустые блоки не выводит', () => {
    const flat = flattenDetails(base())
    expect(flat.description).toBe(
      [
        'Короткое описание',
        'Описание средства в одном абзаце.',
        'Как работает формула:\nПептидный комплекс: уплотняет кожу.\nбез заголовка.',
        'Кому подойдёт:\nВсем типам кожи',
        'Активные ингредиенты:\nEGF',
        'Лайфхак:\nСовет первый.\n\nСовет второй.',
      ].join('\n\n'),
    )
    expect(flat.usage).toBe('Утром: нанести на чистую кожу.\n\nНе смывать.\n\nПримечание')
  })

  it('даёт одинаковый результат для одинакового входа', () => {
    expect(flattenDetails(base())).toEqual(flattenDetails(base()))
  })

  it('usage = null, если у карточки нет способа применения', () => {
    expect(flattenDetails({ ...base(), usage: null }).usage).toBeNull()
  })
})

describe('readDetails', () => {
  it('возвращает карточку из валидного JSON', () => {
    expect(readDetails(JSON.parse(JSON.stringify(base())))).toEqual(base())
  })

  it('невалидное возвращает null и пишет предупреждение', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(readDetails({ v: 2 })).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
  })

  it('пустое значение (NULL в базе) возвращает null без предупреждения', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(readDetails(null)).toBeNull()
    expect(warn).not.toHaveBeenCalled()
  })
})
