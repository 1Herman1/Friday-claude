/**
 * Текст ошибки для покупателя.
 *
 * Наверх из axios прилетает ошибка, у которой `message` — это техническая
 * английская строка вида «Request failed with status code 400». Понятная фраза
 * («Недостаточно товара на складе») лежит в теле ответа: роуты отвечают
 * `{ error: '…' }`. Берём её, а на технические подробности не опускаемся.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const fromBody = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error
  return typeof fromBody === 'string' && fromBody.trim() ? fromBody : fallback
}
