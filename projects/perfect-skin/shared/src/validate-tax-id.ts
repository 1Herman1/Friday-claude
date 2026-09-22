/**
 * Валидация налоговых реквизитов с проверкой контрольной суммы по алгоритмам ФНС.
 */

type ValidationSuccess = {
  ok: true
  kind: 'inn10' | 'inn12' | 'ogrn' | 'ogrnip'
}

type ValidationError = {
  ok: false
  reason: string
}

export type TaxIdValidationResult = ValidationSuccess | ValidationError

/**
 * Проверяет ИНН из 10 цифр (индивидуальные предприниматели).
 * Контрольная цифра (10-я) рассчитывается по весам [2,4,10,3,5,9,4,6,8].
 */
function validateInn10(digits: number[]): boolean {
  if (digits.length !== 10) return false
  const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8]
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * weights[i]
  }
  const check = (sum % 11) % 10
  return check === digits[9]
}

/**
 * Проверяет ИНН из 12 цифр (организации).
 * 11-я цифра рассчитывается по весам [7,2,4,10,3,5,9,4,6,8].
 * 12-я цифра рассчитывается по весам [3,7,2,4,10,3,5,9,4,6,8].
 */
function validateInn12(digits: number[]): boolean {
  if (digits.length !== 12) return false

  // Check 11th digit
  const weights11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
  let sum11 = 0
  for (let i = 0; i < 10; i++) {
    sum11 += digits[i] * weights11[i]
  }
  const check11 = (sum11 % 11) % 10
  if (check11 !== digits[10]) return false

  // Check 12th digit
  const weights12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
  let sum12 = 0
  for (let i = 0; i < 11; i++) {
    sum12 += digits[i] * weights12[i]
  }
  const check12 = (sum12 % 11) % 10
  return check12 === digits[11]
}

/**
 * Проверяет ОГРН из 13 цифр (организации).
 * Контрольная цифра (13-я) рассчитывается как (число_из_первых_12_цифр % 11) % 10.
 * Используем BigInt для работы с числами вплоть до 15 цифр.
 */
function validateOgrn(digits: number[]): boolean {
  if (digits.length !== 13) return false
  const prefix = digits.slice(0, 12).join('')
  const prefixNum = BigInt(prefix)
  const check = Number((prefixNum % BigInt(11)) % BigInt(10))
  return check === digits[12]
}

/**
 * Проверяет ОГРНИП из 15 цифр (индивидуальные предприниматели).
 * Контрольная цифра (15-я) рассчитывается как (число_из_первых_14_цифр % 13) % 10.
 * Используем BigInt для работы с числами вплоть до 15 цифр.
 */
function validateOgrnip(digits: number[]): boolean {
  if (digits.length !== 15) return false
  const prefix = digits.slice(0, 14).join('')
  const prefixNum = BigInt(prefix)
  const check = Number((prefixNum % BigInt(13)) % BigInt(10))
  return check === digits[14]
}

/**
 * Валидирует налоговый реквизит (ИНН, ОГРН или ОГРНИП) по длине и контрольной сумме.
 *
 * @param value Строка с реквизитом (обрезаются пробелы)
 * @returns Объект с результатом валидации
 *
 * @example
 * validateTaxId('7707083893')
 * // { ok: true, kind: 'inn10' }
 *
 * validateTaxId('500100732259')
 * // { ok: true, kind: 'inn12' }
 *
 * validateTaxId('1234567890123')
 * // { ok: false, reason: '...' }
 */
export function validateTaxId(value: string): TaxIdValidationResult {
  // Trim and check for empty
  const cleaned = value.trim()
  if (!cleaned) {
    return { ok: false, reason: 'Реквизит не может быть пустым' }
  }

  // Remove spaces and check for non-digit characters
  const digitsOnly = cleaned.replace(/\s/g, '')
  if (!/^\d+$/.test(digitsOnly)) {
    return { ok: false, reason: 'Реквизит должен содержать только цифры' }
  }

  const digits = digitsOnly.split('').map(Number)

  // Check length and validate checksum
  if (digits.length === 10 && validateInn10(digits)) {
    return { ok: true, kind: 'inn10' }
  }

  if (digits.length === 12 && validateInn12(digits)) {
    return { ok: true, kind: 'inn12' }
  }

  if (digits.length === 13 && validateOgrn(digits)) {
    return { ok: true, kind: 'ogrn' }
  }

  if (digits.length === 15 && validateOgrnip(digits)) {
    return { ok: true, kind: 'ogrnip' }
  }

  // If length matches but checksum fails, say so
  if (digits.length === 10 || digits.length === 12) {
    return { ok: false, reason: 'ИНН содержит ошибку в цифрах — проверьте реквизит' }
  }

  if (digits.length === 13) {
    return { ok: false, reason: 'ОГРН содержит ошибку в цифрах — проверьте реквизит' }
  }

  if (digits.length === 15) {
    return { ok: false, reason: 'ОГРНИП содержит ошибку в цифрах — проверьте реквизит' }
  }

  // Default: unsupported length
  return {
    ok: false,
    reason: 'Реквизит должен быть ИНН (10 или 12 цифр), ОГРН (13 цифр) или ОГРНИП (15 цифр)',
  }
}
