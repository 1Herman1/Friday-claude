import { useEffect, useState } from 'react'
import { deliveryApi, type DeliveryOptionInfo } from '../lib/api'

/** Прайс-лист доставки грузится один раз на вкладку: цены редактирует владелец в админке,
    поэтому на сайте нет ни одной зашитой цифры. */
let cache: DeliveryOptionInfo[] | null = null
let inflight: Promise<DeliveryOptionInfo[]> | null = null

export function loadDeliveryOptions(): Promise<DeliveryOptionInfo[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = deliveryApi.options()
      .then((r) => { cache = r.data.options; return cache })
      .catch(() => { inflight = null; return [] })
  }
  return inflight
}

export function useDeliveryOptions(): DeliveryOptionInfo[] {
  const [options, setOptions] = useState<DeliveryOptionInfo[]>(cache ?? [])
  useEffect(() => {
    let alive = true
    loadDeliveryOptions().then((o) => { if (alive) setOptions(o) })
    return () => { alive = false }
  }, [])
  return options
}

/** Минимальный порог «бесплатно от» среди активных способов; null — бесплатной доставки нет. */
export function minFreeFrom(options: DeliveryOptionInfo[]): number | null {
  const values = options.map((o) => o.freeFrom).filter((v): v is number => v != null && v > 0)
  return values.length ? Math.min(...values) : null
}

/** «сегодня» / «2–5 дн.» из сроков прайс-листа. */
export function etaLabel(o: { etaMin: number | null; etaMax: number | null }): string | null {
  if (o.etaMin == null && o.etaMax == null) return null
  const min = o.etaMin ?? o.etaMax ?? 0
  const max = o.etaMax ?? min
  if (max === 0) return 'сегодня'
  return min === max ? `${min} дн.` : `${min}–${max} дн.`
}
