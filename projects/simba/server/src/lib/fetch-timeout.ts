/**
 * fetch с обязательным таймаутом. У Node нет таймаута сокета по умолчанию:
 * зависшая служба доставки держала бы `/api/delivery/quotes` открытым
 * бесконечно, а с ним — соединения всех покупателей на оформлении.
 */
export const OUTBOUND_TIMEOUT_MS = 8000

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = OUTBOUND_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
