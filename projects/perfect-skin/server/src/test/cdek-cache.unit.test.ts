import { describe, it, expect, vi, afterEach } from 'vitest'
import { CachedLoader } from '../services/cdek/cache.js'

afterEach(() => {
  vi.useRealTimers()
})

describe('CDEK cache: CachedLoader', () => {
  it('десять одновременных промахов дают один вызов загрузки', async () => {
    const loader = new CachedLoader<number>(60_000, 100)
    const load = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
      return 42
    })

    const results = await Promise.all(Array.from({ length: 10 }, () => loader.get('k', load)))

    expect(load).toHaveBeenCalledTimes(1)
    expect(results.every((value) => value === 42)).toBe(true)
  })

  it('после истечения TTL значение загружается заново', async () => {
    vi.useFakeTimers({ now: 1_000_000 })
    const loader = new CachedLoader<string>(60_000, 100)
    const load = vi.fn(async () => 'fresh')

    await loader.get('k', load)
    await loader.get('k', load)
    expect(load).toHaveBeenCalledTimes(1)

    vi.setSystemTime(1_000_000 + 60_001)
    await loader.get('k', load)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('ошибка загрузки не кэшируется', async () => {
    const loader = new CachedLoader<number>(60_000, 100)
    const load = vi
      .fn<[], Promise<number>>()
      .mockRejectedValueOnce(new Error('сеть'))
      .mockResolvedValueOnce(7)

    await expect(loader.get('k', load)).rejects.toThrow('сеть')
    await expect(loader.get('k', load)).resolves.toBe(7)
    expect(load).toHaveBeenCalledTimes(2)
  })
})
