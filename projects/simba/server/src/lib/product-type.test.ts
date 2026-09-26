import { describe, expect, it } from 'vitest'
import { classifyType, WET_NAME } from './product-type'
import { withFormatTag } from './quiz-tags'

const p = (name: string, tags: string[] = []) => ({ name, quizTags: tags, autoQuizTags: [] })

describe('classifyType', () => {
  it('узнаёт лечебные линейки в любом регистре и написании', () => {
    expect(classifyType(p('Happy Cat VET Diet Renal'))).toBe('medical')
    expect(classifyType(p('Forza10 Active VetDiet URINARY Cat'))).toBe('medical')
    expect(classifyType(p('Forza10 Intestinal Colon Fase II Dog (Рыба)'))).toBe('medical')
    expect(classifyType(p('Royal Canin Renal'))).toBe('medical')
  })

  it('не считает лечебным обычный корм для чувствительного пищеварения', () => {
    expect(classifyType(p('Happy Cat Sensitive Magen & Darm (Stomach & Intestinal)'))).toBeNull()
  })

  it('относит к уходу бальзам и инструменты груминга', () => {
    expect(classifyType(p('Бальзам-кондиционер Muzzle для собак и кошек'))).toBe('care')
    expect(classifyType(p('Muzzle Когтерез с подсветкой для животных'))).toBe('care')
    expect(classifyType(p('Воск для лап защита от реагентов, снега и соли 100 мл'))).toBe('care')
  })

  it('относит лечебные травы к ветаптеке', () => {
    expect(classifyType(p('Muzzle Лечебные травы глистогон для кошек'))).toBe('vet')
  })

  it('оставляет аксессуары без типа', () => {
    expect(classifyType(p('Многоразовая впитывающая пеленка для собак и кошек - 40х60'))).toBeNull()
    expect(classifyType(p('Muzzle Демисезонный дождевик для собак - горчица'))).toBeNull()
  })

  it('берёт формат из тегов', () => {
    expect(classifyType(p('Forza10 Maintenance Dog (ягненок)', ['format:dry']))).toBe('dry')
    expect(classifyType(p('Forza 10 Maintenance Dog (утка), влажный', ['format:wet']))).toBe('wet')
  })
})

describe('WET_NAME', () => {
  it('ловит подписанный влажный корм', () => {
    expect(WET_NAME.test('Forza 10 Maintenance Dog (утка), влажный')).toBe(true)
    expect(WET_NAME.test('Happy Cat Culinary Кусочки в соусе (Утка)')).toBe(true)
    expect(WET_NAME.test('Farmina Matisse Cat Mousse Salmon')).toBe(true)
  })

  it('не ловит сухой корм', () => {
    expect(WET_NAME.test('Forza10 Maintenance Dog Adult Mini (курица)')).toBe(false)
    expect(WET_NAME.test("Hill's Science Plan Adult Mini (тунец)")).toBe(false)
  })
})

describe('withFormatTag', () => {
  it('заменяет прежний формат и не трогает остальные теги', () => {
    expect(withFormatTag(['species:dog', 'format:wet'], 'dry')).toEqual(['species:dog', 'format:dry'])
  })
})
