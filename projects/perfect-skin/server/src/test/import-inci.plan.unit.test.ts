import { describe, it, expect } from 'vitest'
import { InciFileSchema, planInci, type InciItem } from '../lib/import-inci.plan.js'

const keep = (slug: string, inci: string): InciItem => ({ slug, inci, clientDecision: 'keep' })

describe('planInci', () => {
  it('товар с решением skip не меняется, даже если INCI пустой', () => {
    const plan = planInci([{ slug: 'a', inci: 'AQUA', clientDecision: 'skip' }], [{ slug: 'a', inciText: null }])
    expect(plan.changes).toEqual([])
    expect(plan.skipped).toEqual(['a'])
  })

  it('skip не очищает и не перезаписывает уже заполненный inciText', () => {
    const plan = planInci([{ slug: 'a', inci: 'NEW', clientDecision: 'skip' }], [{ slug: 'a', inciText: 'OLD' }])
    expect(plan.changes).toEqual([])
  })

  it('INCI, уже совпадающий с файлом, не попадает в изменения', () => {
    const plan = planInci([keep('a', 'AQUA, GLYCERIN')], [{ slug: 'a', inciText: 'AQUA, GLYCERIN' }])
    expect(plan.changes).toEqual([])
    expect(plan.unchanged).toEqual(['a'])
  })

  it('слаг без живого товара попадает в missing, а не молча пропускается', () => {
    const plan = planInci([keep('b', 'AQUA')], [{ slug: 'a', inciText: null }])
    expect(plan.changes).toEqual([])
    expect(plan.missing).toEqual(['b'])
  })

  it('пробелы и переводы строк по краям обрезаются до записи и до сравнения', () => {
    const plan = planInci(
      [keep('a', '  AQUA, GLYCERIN \n'), keep('b', ' AQUA ')],
      [
        { slug: 'a', inciText: null },
        { slug: 'b', inciText: 'AQUA' },
      ],
    )
    expect(plan.changes).toEqual([{ slug: 'a', from: null, to: 'AQUA, GLYCERIN' }])
    expect(plan.unchanged).toEqual(['b'])
  })

  it('несколько живых товаров с одним слагом — неоднозначно, без записи', () => {
    const plan = planInci([keep('a', 'AQUA')], [
      { slug: 'a', inciText: null },
      { slug: 'a', inciText: null },
    ])
    expect(plan.changes).toEqual([])
    expect(plan.ambiguous).toEqual(['a'])
  })
})

describe('InciFileSchema', () => {
  it('решение вне keep/skip — ошибка файла, а не тихий пропуск', () => {
    const parsed = InciFileSchema.safeParse({ items: [{ slug: 'a', inci: 'AQUA', clientDecision: 'kep' }] })
    expect(parsed.success).toBe(false)
  })
})
