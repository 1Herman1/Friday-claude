// Логика отбора профильных бизнесов по кодам ОКВЭД.

/**
 * Парсит список префиксов ОКВЭД из переменной окружения.
 * Формат: "96.02,96.04,86.90,86.22,46.45,47.75"
 * Если env пустая или не задана — возвращает дефолтный список.
 */
export function parseOkvedPrefixes(env?: string): string[] {
  if (!env || env.trim() === '') {
    return ['96.02', '96.04', '86.90', '86.22', '46.45', '47.75']
  }
  return env.split(',').map(p => p.trim()).filter(p => p.length > 0)
}

/**
 * Проверяет, является ли запись профильной по кодам ОКВЭД.
 *
 * Логика: запись профильна, если ЛЮБОЙ код из массива codes равен префиксу
 * или начинается с префикса + '.'. То есть:
 * - '86.90' покрывает '86.90' и '86.90.4', но НЕ '86.9' и НЕ '86.900'
 * - '47.75' покрывает '47.75', но НЕ '47.7'
 *
 * @param codes - массив кодов ОКВЭД (например, ['96.02', '45.20'])
 * @param prefixes - массив префиксов (например, ['96.02', '86.90'])
 * @returns true, если найдено совпадение
 */
export function isProfileOkved(codes: string[], prefixes: string[]): boolean {
  if (!codes || codes.length === 0 || !prefixes || prefixes.length === 0) {
    return false
  }

  for (const code of codes) {
    for (const prefix of prefixes) {
      // Точное совпадение
      if (code === prefix) {
        return true
      }
      // Совпадение по префиксу с точкой (86.90 покрывает 86.90.4)
      if (code.startsWith(prefix + '.')) {
        return true
      }
    }
  }

  return false
}
