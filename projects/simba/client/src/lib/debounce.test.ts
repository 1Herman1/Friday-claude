import { describe, it, expect, vi } from 'vitest'
import { createDebouncedAsync } from './debounce'

describe('createDebouncedAsync', () => {
  it('вызывает функцию один раз после паузы, с последними аргументами', async () => {
    vi.useFakeTimers()
    const fn = vi.fn(async (q: string) => q.toUpperCase())
    const debounced = createDebouncedAsync(fn, 300)

    debounced('тв')
    debounced('тве')
    const last = debounced('твер')
    expect(fn).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(300)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('твер')
    await expect(last).resolves.toBe('ТВЕР')
    vi.useRealTimers()
  })

  it('ошибка функции доходит до вызывающего', async () => {
    vi.useFakeTimers()
    const debounced = createDebouncedAsync(async () => {
      throw new Error('сеть')
    }, 100)
    // Ожидание вешаем до прокрутки таймеров: иначе отказ промиса какое-то
    // время висит без обработчика и Vitest считает его unhandled rejection.
    const expectation = expect(debounced()).rejects.toThrow('сеть')
    await vi.advanceTimersByTimeAsync(100)
    await expectation
    vi.useRealTimers()
  })

  it('cancel отменяет отложенный вызов — уход со страницы не шлёт запрос', async () => {
    vi.useFakeTimers()
    const fn = vi.fn(async (q: string) => q.toUpperCase())
    const debounced = createDebouncedAsync(fn, 300)

    debounced('твер')
    debounced.cancel()

    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).not.toHaveBeenCalled()

    // После отмены обработчик снова рабочий: следующий ввод уходит как обычно.
    const next = debounced('тула')
    await vi.advanceTimersByTimeAsync(300)
    await expect(next).resolves.toBe('ТУЛА')
    expect(fn).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
