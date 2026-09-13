/**
 * Ограничение частоты запросов по IP, в памяти процесса.
 *
 * Корзины раздельные: расчёт доставки, подсказки адреса и список пунктов
 * выдачи считаются каждая по себе. Общий счётчик на всё оформление заказа
 * исчерпывался одним покупателем: десяток подсказок при наборе адреса плюс
 * пересчёты доставки — и 429 посреди чекаута.
 */

type Bucket = 'quotes' | 'suggest' | 'pickup-points' | 'visits' | 'promo'

const WINDOW_MS = 5 * 60 * 1000

const LIMITS: Record<Bucket, number> = {
  quotes: 40,
  /// Подсказка уходит на каждую паузу в наборе — один адрес это 5–10 запросов.
  suggest: 40,
  'pickup-points': 30,
  /// Один пинг в сутки на браузер; лимит лишь против злоупотреблений.
  visits: 60,
  /// подбор промокодов перебором
  promo: 30,
}

const buckets: Record<Bucket, Map<string, { count: number; resetAt: number }>> = {
  quotes: new Map(),
  suggest: new Map(),
  'pickup-points': new Map(),
  visits: new Map(),
  promo: new Map(),
}

let lastSweepAt = Date.now()

/** Иначе карта растёт на каждый новый IP и никогда не худеет. */
function sweep(now: number) {
  if (now - lastSweepAt < WINDOW_MS) return
  lastSweepAt = now
  for (const map of Object.values(buckets)) {
    for (const [ip, entry] of map) {
      if (now > entry.resetAt) map.delete(ip)
    }
  }
}

export function checkRateLimit(ip: string, bucket: Bucket = 'quotes'): boolean {
  const now = Date.now()
  sweep(now)

  const map = buckets[bucket]
  const entry = map.get(ip)

  if (!entry || now > entry.resetAt) {
    map.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }

  if (entry.count >= LIMITS[bucket]) return false

  entry.count += 1
  return true
}
