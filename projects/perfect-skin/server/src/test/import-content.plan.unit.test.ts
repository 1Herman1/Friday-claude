import { describe, it, expect } from 'vitest'
import {
  canonicalJson,
  parseDetailsFile,
  planProductContent,
  type CurrentContent,
} from '../lib/import-content.plan.js'
import { ProductDetailsSchema, textLimitIssue, type ProductDetails } from '../lib/product-details.js'

const details = (): ProductDetails => ({
  v: 1,
  tagline: ['Короткое описание'],
  intro: ['Описание средства.'],
  extra: [],
  howItWorks: {
    heading: 'Как работает формула',
    lead: [],
    items: [{ title: 'Пептиды', text: 'уплотняют кожу.' }],
    result: null,
  },
  actives: ['EGF'],
  forWhom: { lead: null, items: ['Всем типам кожи'], note: [] },
  usage: {
    heading: 'СПОСОБ ПРИМЕНЕНИЯ',
    steps: [{ title: 'Утром', text: 'нанести на чистую кожу.' }],
    notes: [],
  },
  lifehack: null,
  pro: null,
})

const emptyCurrent = (): CurrentContent => ({ details: null, description: '', usage: null })

// Имитация записи в базу: то, что план вернул в data, становится текущим состоянием.
function applyPlan(current: CurrentContent, data: { details?: unknown; description?: string; usage?: string }): CurrentContent {
  return {
    details: data.details ?? current.details,
    description: data.description ?? current.description,
    usage: data.usage ?? current.usage,
  }
}

describe('planProductContent', () => {
  it('первый прогон пишет карточку, описание и применение', () => {
    const plan = planProductContent(emptyCurrent(), details())
    expect(plan.data.details).toEqual(details())
    expect(plan.data.description).toBe('Короткое описание\n\nОписание средства.\n\nКак работает формула:\nПептиды: уплотняют кожу.\n\nКому подойдёт:\nВсем типам кожи\n\nАктивные ингредиенты:\nEGF')
    expect(plan.data.usage).toBe('Утром: нанести на чистую кожу.')
  })

  it('повторный прогон после записи ничего не меняет', () => {
    const first = planProductContent(emptyCurrent(), details())
    const after = applyPlan(emptyCurrent(), first.data)
    const second = planProductContent(after, details())
    expect(second.data).toEqual({})
    expect(second.fields.every((field) => field.state !== 'changed')).toBe(true)
  })

  it('порядок ключей в JSONB из базы не считается изменением карточки', () => {
    const reordered = JSON.parse(JSON.stringify(details()), (_key, value: unknown) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.fromEntries(Object.entries(value as Record<string, unknown>).reverse())
      }
      return value
    })
    const plan = planProductContent({ details: reordered, description: '', usage: null }, details())
    expect(plan.fields.find((field) => field.field === 'details')?.state).toBe('same')
  })

  it('usage сохраняется, если в карточке нет способа применения', () => {
    const noUsage = { ...details(), usage: null }
    const current: CurrentContent = { details: null, description: 'старый текст', usage: 'старое применение' }
    const plan = planProductContent(current, noUsage)
    expect(plan.data.usage).toBeUndefined()
    expect(plan.fields.find((field) => field.field === 'usage')?.state).toBe('not-in-card')
  })

  it('описание длиннее 20000 знаков — отказ всего прогона', () => {
    const tooLong = { ...details(), intro: Array.from({ length: 12 }, () => 'я'.repeat(2500)) }
    expect(() => planProductContent(emptyCurrent(), tooLong)).toThrow('описание длиннее 20000 знаков')
  })

  it('граница лимита: 20000 знаков проходит, 20001 — нет', () => {
    expect(textLimitIssue({ description: 'я'.repeat(20000) })).toBeNull()
    expect(textLimitIssue({ description: 'я'.repeat(20001) })).toBe('описание длиннее 20000 знаков')
  })

  it('применение длиннее 10000 знаков — отказ, а не обрезка', () => {
    const steps = Array.from({ length: 14 }, () => ({ title: null, text: 'ш'.repeat(900) }))
    const longUsage = { ...details(), usage: { heading: 'СПОСОБ ПРИМЕНЕНИЯ', steps, notes: [] } }
    expect(() => planProductContent(emptyCurrent(), longUsage)).toThrow('применение длиннее 10000 знаков')
  })
})

describe('canonicalJson', () => {
  it('одинаковые объекты с разным порядком ключей дают одну строку', () => {
    expect(canonicalJson({ b: 1, a: { d: 1, c: [{ y: 1, x: 2 }] } })).toBe(canonicalJson({ a: { c: [{ x: 2, y: 1 }], d: 1 }, b: 1 }))
  })
})

describe('parseDetailsFile', () => {
  it('лишние служебные поля файла (sources, warnings) отбрасываются', () => {
    const parsed = parseDetailsFile('x.json', { slug: 'x-slug', sources: [], warnings: ['w'], details: details() })
    expect(parsed).toEqual({ slug: 'x-slug', details: details() })
  })

  it('ошибка указывает файл и путь до поля', () => {
    const broken = { slug: 'x-slug', details: { ...details(), actives: ['   '] } }
    expect(() => parseDetailsFile('broken.json', broken)).toThrow(/^broken\.json: details\.actives\.0: не может быть пустым$/)
  })

  it('slug с заглавными или пробелами отвергается', () => {
    expect(() => parseDetailsFile('x.json', { slug: 'Bad Slug', details: details() })).toThrow(/x\.json: slug/)
  })

  it('карточка, которую схема не пропускает, в файл не попадает', () => {
    expect(ProductDetailsSchema.safeParse({ ...details(), v: 2 }).success).toBe(false)
  })
})
