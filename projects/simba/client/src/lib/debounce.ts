/**
 * Debounce хук для асинхронных функций с отменой устаревших запросов.
 * Каждый новый вызов отменяет предыдущий timeout.
 * Используется для отмены старых запросов API, если пришел новый.
 */
export function createDebouncedAsync<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  delay?: number
): ((...args: Args) => Promise<R>) & { cancel(): void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let requestCount = 0
  const waitTime = delay ?? 300

  const debounced = (...args: Args) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    const currentRequest = ++requestCount

    return new Promise<R>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        // Если пока мы ждали, пришел новый запрос, отменяем этот
        if (currentRequest === requestCount) {
          fn(...args).then(resolve).catch(reject)
        }
      }, waitTime)
    })
  }

  // Уход со страницы во время паузы: отложенный вызов не должен сработать.
  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = null
    requestCount += 1
  }

  return debounced
}
