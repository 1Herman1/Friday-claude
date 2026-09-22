import { describe, it, expect } from 'vitest'
import { validateTaxId } from './validate-tax-id'

describe('validateTaxId', () => {
  describe('ИНН 10 цифр (ИП)', () => {
    it('принимает корректный ИНН 10 цифр', () => {
      const result = validateTaxId('7707083893')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.kind).toBe('inn10')
      }
    })

    it('отклоняет ИНН 10 цифр с неверной контрольной суммой', () => {
      const result = validateTaxId('7707083892') // последняя цифра изменена с 3 на 2
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toContain('ИНН')
      }
    })

    it('отклоняет ИНН 10 цифр с буквами', () => {
      const result = validateTaxId('770708389A')
      expect(result.ok).toBe(false)
    })

    it('принимает ИНН 10 цифр с пробелами (обрезает их)', () => {
      const result = validateTaxId('  7707083893  ')
      expect(result.ok).toBe(true)
    })
  })

  describe('ИНН 12 цифр (ООО)', () => {
    it('принимает корректный ИНН 12 цифр', () => {
      const result = validateTaxId('500100732259')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.kind).toBe('inn12')
      }
    })

    it('отклоняет ИНН 12 цифр с неверной контрольной суммой на 11-й позиции', () => {
      const result = validateTaxId('500100732249') // 11-я цифра: 5->4
      expect(result.ok).toBe(false)
    })

    it('отклоняет ИНН 12 цифр с неверной контрольной суммой на 12-й позиции', () => {
      const result = validateTaxId('500100732250') // 12-я цифра: 9->0
      expect(result.ok).toBe(false)
    })
  })

  describe('ОГРН 13 цифр (ООО)', () => {
    it('принимает корректный ОГРН 13 цифр', () => {
      const result = validateTaxId('1027700132195')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.kind).toBe('ogrn')
      }
    })

    it('отклоняет ОГРН 13 цифр с неверной контрольной суммой', () => {
      const result = validateTaxId('1027700132194') // последняя цифра: 5->4
      expect(result.ok).toBe(false)
    })
  })

  describe('ОГРНИП 15 цифр (ИП)', () => {
    it('принимает корректный ОГРНИП 15 цифр', () => {
      const result = validateTaxId('304500116000157')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.kind).toBe('ogrnip')
      }
    })

    it('отклоняет ОГРНИП 15 цифр с неверной контрольной суммой', () => {
      const result = validateTaxId('304500116000156') // последняя цифра: 7->6
      expect(result.ok).toBe(false)
    })
  })

  describe('Граничные случаи', () => {
    it('отклоняет пустую строку', () => {
      const result = validateTaxId('')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toContain('пустым')
      }
    })

    it('отклоняет строку только с пробелами', () => {
      const result = validateTaxId('   ')
      expect(result.ok).toBe(false)
    })

    it('отклоняет 11 цифр (не поддерживаемая длина)', () => {
      const result = validateTaxId('12345678901')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toContain('ИНН') // Должна быть 10 или 12
      }
    })

    it('отклоняет 14 цифр (не поддерживаемая длина)', () => {
      const result = validateTaxId('12345678901234')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toContain('ОГРНИП') // Должна быть 13 или 15
      }
    })

    it('отклоняет реквизит с дефисами (небуквы, не цифры)', () => {
      const result = validateTaxId('7707-083-893')
      expect(result.ok).toBe(false)
    })

    it('отклоняет реквизит смешанный букво-цифровой', () => {
      const result = validateTaxId('77070838a3')
      expect(result.ok).toBe(false)
    })
  })

  describe('Отличие по типам реквизитов (разные сообщения об ошибках)', () => {
    it('ИНН 10 с ошибкой содержит сообщение про ИНН', () => {
      const result = validateTaxId('7707083892')
      if (!result.ok) {
        expect(result.reason).toContain('ИНН')
      }
    })

    it('ОГРН 13 с ошибкой содержит сообщение про ОГРН', () => {
      const result = validateTaxId('1027700132194')
      if (!result.ok) {
        expect(result.reason).toContain('ОГРН')
      }
    })

    it('ОГРНИП 15 с ошибкой содержит сообщение про ОГРНИП', () => {
      const result = validateTaxId('304500116000156')
      if (!result.ok) {
        expect(result.reason).toContain('ОГРНИП')
      }
    })
  })
})
