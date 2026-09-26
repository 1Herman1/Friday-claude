import { maskInn } from './masks.js'

export type NpdResult = 'self_employed' | 'not_self_employed' | 'unavailable'

/**
 * Проверяет статус ИП в реестре НПД ФНС.
 *
 * POST https://statusnpd.nalog.ru/api/v1/tracker/taxpayer_status
 * Тело: { inn, requestDate: 'YYYY-MM-DD' }
 *
 * Возвращает:
 * - 'self_employed' если status = true
 * - 'not_self_employed' если status = false
 * - 'unavailable' при любых ошибках (таймаут, битый JSON, код ≠ 200, etc.)
 */
export async function checkSelfEmployed(
  inn: string,
  opts?: { fetchImpl?: typeof fetch; now?: Date }
): Promise<NpdResult> {
  const fetchImpl = opts?.fetchImpl ?? globalThis.fetch
  const now = opts?.now ?? new Date()

  // Формируем дату по Москве (UTC+3)
  const moscowDate = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const requestDate = moscowDate.toISOString().split('T')[0] // YYYY-MM-DD

  const url = 'https://statusnpd.nalog.ru/api/v1/tracker/taxpayer_status'
  const body = JSON.stringify({ inn, requestDate })

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (response.status !== 200) {
      return 'unavailable'
    }

    const data = await response.json() as { status?: boolean; message?: string }
    const status = data.status

    if (typeof status !== 'boolean') {
      return 'unavailable'
    }

    return status ? 'self_employed' : 'not_self_employed'
  } catch (err) {
    // Таймаут, сетевая ошибка, битый JSON, AbortError — всё это unavailable
    return 'unavailable'
  }
}
