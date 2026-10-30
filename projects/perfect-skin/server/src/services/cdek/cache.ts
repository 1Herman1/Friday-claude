import { TtlCache } from '../../lib/ttl-cache.js'

export class CachedLoader<V> {
  private readonly cache: TtlCache<V>
  private readonly inFlight = new Map<string, Promise<V>>()

  constructor(
    private readonly ttlMs: number,
    maxEntries: number
  ) {
    this.cache = new TtlCache<V>(ttlMs, maxEntries)
  }

  get(key: string, load: () => Promise<V>, ttlOf?: (value: V) => number): Promise<V> {
    const cached = this.cache.get(key)
    if (cached !== undefined) return Promise.resolve(cached)

    const pending = this.inFlight.get(key)
    if (pending !== undefined) return pending

    const loading = this.fill(key, load, ttlOf)
    this.inFlight.set(key, loading)
    return loading
  }

  private async fill(key: string, load: () => Promise<V>, ttlOf?: (value: V) => number): Promise<V> {
    try {
      const value = await load()
      this.cache.set(key, value, Date.now(), ttlOf?.(value) ?? this.ttlMs)
      return value
    } finally {
      this.inFlight.delete(key)
    }
  }
}
