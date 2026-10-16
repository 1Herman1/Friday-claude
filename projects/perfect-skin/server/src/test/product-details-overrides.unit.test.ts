import { describe, it, expect } from 'vitest'
import { applyActivesOverrides, DetailsOverridesFileSchema } from '../lib/product-details-overrides.js'

const unit = (slug: string, actives: string[]): { slug: string; details: { actives: string[]; intro: string[] } } => ({
  slug,
  details: { actives, intro: ['Описание'] },
})

describe('applyActivesOverrides', () => {
  it('заменяет actives целиком и не трогает остальные поля карточки', () => {
    const [result] = applyActivesOverrides(
      [unit('a', ['Экстракт розмарина', 'Витамин Е'])],
      { a: { actives: ['Масло шиповника', 'Озон'] } },
    )
    expect(result.details).toEqual({ actives: ['Масло шиповника', 'Озон'], intro: ['Описание'] })
  })

  it('правка для слага без карточки — ошибка, а не тихий пропуск', () => {
    expect(() => applyActivesOverrides([unit('a', [])], { b: { actives: ['Озон'] } })).toThrow(/b/)
  })

  it('товары без правки остаются как были', () => {
    const other = unit('b', ['EGF'])
    const [first, second] = applyActivesOverrides([unit('a', []), other], { a: { actives: ['Озон'] } })
    expect(first.details.actives).toEqual(['Озон'])
    expect(second).toBe(other)
  })
})

describe('DetailsOverridesFileSchema', () => {
  it('неизвестное поле в правке — ошибка файла', () => {
    const parsed = DetailsOverridesFileSchema.safeParse({
      _meta: { note: 'тест' },
      overrides: { a: { active: ['Озон'] } },
    })
    expect(parsed.success).toBe(false)
  })
})
