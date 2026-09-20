/**
 * Маскирование персональных данных для логов.
 * ГОСТ-safe: скрывает чувствительные данные, оставляя достаточно для диагностики.
 */

/**
 * Маскирует email адрес для логов.
 * Пример: ivan.petrov@example.com → iv***@example.com
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***@***'
  // Показываем первые 2 символа локальной части (или если там меньше, всё)
  const localPart = local.length > 2 ? local.slice(0, 2) + '***' : '***'
  return `${localPart}@${domain}`
}

/**
 * Маскирует номер телефона для логов.
 * Пример: +79991234567 → +79***4567
 */
export function maskPhone(phone: string): string {
  // Телефон формата +7XXXXXXXXXX (11 цифр)
  if (!phone || phone.length < 5) return '***'
  // Показываем префикс (+7) и последние 4 цифры
  return phone.slice(0, 3) + '***' + phone.slice(-4)
}
