import { describe, it, expect } from 'vitest'
import { applyDetailsOverrides, DetailsOverridesFileSchema } from '../lib/product-details-overrides.js'
import type { ProductDetails } from '../lib/product-details.js'

const details = (patch: Partial<ProductDetails> = {}): ProductDetails => ({
  v: 1,
  tagline: [],
  intro: ['Описание'],
  extra: [],
  howItWorks: null,
  actives: [],
  forWhom: null,
  usage: null,
  lifehack: null,
  pro: null,
  ...patch,
})

const howItWorks = (titles: string[]): NonNullable<ProductDetails['howItWorks']> => ({
  heading: 'Как работает формула',
  lead: [],
  items: titles.map((title) => ({ title, text: `Действие: ${title}` })),
  result: null,
})

const unit = (slug: string, patch: Partial<ProductDetails> = {}): { slug: string; details: ProductDetails } => ({
  slug,
  details: details(patch),
})

describe('applyDetailsOverrides', () => {
  it('заменяет actives целиком и не трогает остальные поля карточки', () => {
    const [result] = applyDetailsOverrides(
      [unit('a', { actives: ['Экстракт розмарина', 'Витамин Е'] })],
      { a: { actives: ['Масло шиповника', 'Озон'] } },
    )
    expect(result.details).toEqual(details({ actives: ['Масло шиповника', 'Озон'] }))
  })

  it('удаляет пункт «Как работает» с точным заголовком', () => {
    const [result] = applyDetailsOverrides(
      [unit('a', { howItWorks: howItWorks(['Гераниол (из масла герани)', 'Экстракт алоэ вера']) })],
      { a: { removeHowItWorks: ['Гераниол (из масла герани)'] } },
    )
    expect(result.details.howItWorks?.items.map((item) => item.title)).toEqual(['Экстракт алоэ вера'])
  })

  it('заголовок, которого нет в «Как работает» (даже частично), — ошибка', () => {
    expect(() =>
      applyDetailsOverrides(
        [unit('a', { howItWorks: howItWorks(['Гераниол (из масла герани)']) })],
        { a: { removeHowItWorks: ['Гераниол'] } },
      ),
    ).toThrow('правка a: нет пункта «Как работает» с заголовком: Гераниол')
  })

  it('заменяет фрагмент в intro', () => {
    const [result] = applyDetailsOverrides(
      [unit('a', { intro: ['Молочко с микроцеллюлозой и гераниолем не просто удаляет макияж.'] })],
      { a: { replace: [{ from: 'с микроцеллюлозой и гераниолем', to: 'с микроцеллюлозой' }] } },
    )
    expect(result.details.intro).toEqual(['Молочко с микроцеллюлозой не просто удаляет макияж.'])
  })

  it('замена проходит по вложенным полям: «Как работает», применение, лайфхак', () => {
    const [result] = applyDetailsOverrides(
      [
        unit('a', {
          howItWorks: { heading: 'Как работает', lead: ['Работает АТФ'], items: [{ title: null, text: 'Клетки получают АТФ' }], result: null },
          usage: { heading: 'Способ', steps: [{ title: 'АТФ', text: 'Нанесите' }], notes: [] },
          lifehack: { title: null, paragraphs: ['Маска с АТФ'] },
        }),
      ],
      { a: { replace: [{ from: 'АТФ', to: 'Пептиды' }] } },
    )
    expect(result.details.howItWorks).toEqual({
      heading: 'Как работает',
      lead: ['Работает Пептиды'],
      items: [{ title: null, text: 'Клетки получают Пептиды' }],
      result: null,
    })
    expect(result.details.usage?.steps[0]).toEqual({ title: 'Пептиды', text: 'Нанесите' })
    expect(result.details.lifehack?.paragraphs).toEqual(['Маска с Пептиды'])
  })

  it('замена не трогает actives', () => {
    const [result] = applyDetailsOverrides(
      [unit('a', { actives: ['Гераниол'], intro: ['Гераниол в составе'] })],
      { a: { replace: [{ from: 'Гераниол', to: 'Ромашка' }] } },
    )
    expect(result.details.actives).toEqual(['Гераниол'])
    expect(result.details.intro).toEqual(['Ромашка в составе'])
  })

  it('замена фрагмента, которого нет в тексте, — ошибка с товаром и фрагментом', () => {
    expect(() =>
      applyDetailsOverrides([unit('a')], { a: { replace: [{ from: 'нет такого', to: 'x' }] } }),
    ).toThrow('правка a: фрагмент «нет такого» не найден')
  })

  it('результат проверяется ProductDetailsSchema: пустой intro — ошибка', () => {
    expect(() =>
      applyDetailsOverrides([unit('a')], { a: { replace: [{ from: 'Описание', to: '' }] } }),
    ).toThrow()
  })

  it('товары без правки остаются как были', () => {
    const other = unit('b', { actives: ['EGF'] })
    const [first, second] = applyDetailsOverrides([unit('a'), other], { a: { actives: ['Озон'] } })
    expect(first.details.actives).toEqual(['Озон'])
    expect(second).toBe(other)
  })

  it('правка для слага без карточки — ошибка, а не тихий пропуск', () => {
    expect(() => applyDetailsOverrides([unit('a')], { b: { actives: ['Озон'] } })).toThrow(/b/)
  })

  it('комбинация: состав, удаление пункта и замена фразы в одной правке', () => {
    const [result] = applyDetailsOverrides(
      [unit('a', { intro: ['Формула с АТФ и гиалуроновой кислотой'], howItWorks: howItWorks(['АТФ (аденозинтрифосфат)', 'Алоэ']) })],
      {
        a: {
          actives: ['Алоэ вера'],
          removeHowItWorks: ['АТФ (аденозинтрифосфат)'],
          replace: [{ from: 'с АТФ и гиалуроновой', to: 'с гиалуроновой' }],
        },
      },
    )
    expect(result.details.actives).toEqual(['Алоэ вера'])
    expect(result.details.intro).toEqual(['Формула с гиалуроновой кислотой'])
    expect(result.details.howItWorks?.items.map((item) => item.title)).toEqual(['Алоэ'])
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

  it('правка без единой операции — ошибка файла', () => {
    const parsed = DetailsOverridesFileSchema.safeParse({
      _meta: { note: 'тест' },
      overrides: { a: {} },
    })
    expect(parsed.success).toBe(false)
  })
})
