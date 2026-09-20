/**
 * Маска и валидация российских номеров телефона.
 * Формат: +7 999 123-45-67
 */

/** Нормализовать номер к виду: 79991234567 (без +, пробелов, тире) */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  // Если начинается с 8, заменить на 7 (8-800-... → 7-800-...)
  if (digits.startsWith('8')) return '7' + digits.slice(1)
  // Если начинается с 7, оставить как есть
  if (digits.startsWith('7')) return digits
  // Если только 10 цифр (без страны), добавить 7
  if (digits.length === 10) return '7' + digits
  return digits
}

/** Проверить, валидный ли российский номер (79991234567 или +79991234567) */
export function isValidPhoneRU(value: string): boolean {
  const normalized = normalizePhone(value)
  // Должно быть 11 цифр, начинаться с 7, вторая цифра — не 0
  return /^7[1-9]\d{9}$/.test(normalized)
}

/** Применить маску: 79991234567 → +7 999 123-45-67 */
export function formatPhoneDisplay(normalized: string): string {
  const digits = normalized.replace(/\D/g, '')
  if (digits.length === 0) return ''
  if (digits.length <= 1) return `+${digits}`
  if (digits.length <= 4) return `+${digits[0]} ${digits.slice(1)}`
  if (digits.length <= 7) return `+${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4)}`
  return `+${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`
}

/**
 * Обработчик ввода в поле телефона: применить маску и нормализировать
 * Возвращает отформатированное значение для отображения
 */
export function handlePhoneInput(value: string): string {
  const normalized = normalizePhone(value)
  return formatPhoneDisplay(normalized)
}
