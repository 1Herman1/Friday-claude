/**
 * Загрузчик Яндекс.Карт JS API v3.
 *
 * Ключ — `VITE_YANDEX_MAPS_KEY` на сборке. Правило владельца: без ключа среда
 * под него не показывается вовсе, поэтому без ключа скрипт даже не вставляется
 * и функция сразу отвечает null. Тот же null — если скрипт не загрузился или не
 * ответил за LOAD_TIMEOUT_MS (плохой ключ, нет сети): вызывающий тогда работает
 * как без карты.
 *
 * Типы ниже — ровно та часть v3, что нужна выбору пункта выдачи. Важно:
 * координаты в v3 — [долгота, широта], не наоборот.
 */

export type LngLat = [number, number]

export interface YMapLocation {
  center?: LngLat
  zoom?: number
  bounds?: [LngLat, LngLat]
  /** Длительность анимации переезда, мс. */
  duration?: number
}

export interface YMap {
  addChild(child: unknown): YMap
  removeChild(child: unknown): YMap
  setLocation(location: YMapLocation): void
  readonly bounds: [LngLat, LngLat]
  destroy(): void
}

export interface YMaps {
  ready: Promise<unknown>
  YMap: new (
    container: HTMLElement,
    props: { location: YMapLocation; showScaleInCopyrights?: boolean }
  ) => YMap
  YMapDefaultSchemeLayer: new (props?: Record<string, unknown>) => unknown
  YMapDefaultFeaturesLayer: new (props?: Record<string, unknown>) => unknown
  YMapMarker: new (
    props: { coordinates: LngLat; onClick?: () => void; zIndex?: number },
    element?: HTMLElement
  ) => unknown
  YMapListener: new (props: { onUpdate?: (event: { location: YMapLocation }) => void }) => unknown
}

declare global {
  interface Window {
    ymaps3?: YMaps
  }
}

const LOAD_TIMEOUT_MS = 5000

let ymapsPromise: Promise<YMaps | null> | null = null

export function hasYandexMapsKey(): boolean {
  return Boolean(import.meta.env.VITE_YANDEX_MAPS_KEY)
}

export function loadYandexMaps(): Promise<YMaps | null> {
  if (ymapsPromise) return ymapsPromise

  const key = import.meta.env.VITE_YANDEX_MAPS_KEY
  if (!key) return Promise.resolve(null)

  ymapsPromise = new Promise<YMaps | null>((resolve) => {
    let settled = false
    const finish = (lib: YMaps | null, reason?: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (!lib) console.warn(`[Яндекс.Карты] карта не загрузилась: ${reason ?? 'неизвестно'}`)
      resolve(lib)
    }

    // Зависший запрос к CDN — не ошибка и не загрузка: без таймаута покупатель
    // смотрел бы на пустое место под карту бесконечно.
    const timer = setTimeout(() => finish(null, `нет ответа за ${LOAD_TIMEOUT_MS} мс`), LOAD_TIMEOUT_MS)

    if (window.ymaps3) {
      window.ymaps3.ready.then(() => finish(window.ymaps3 ?? null), () => finish(null, 'ready отклонён'))
      return
    }

    const script = document.createElement('script')
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(key)}&lang=ru_RU`
    script.async = true
    script.onload = () => {
      const lib = window.ymaps3
      if (!lib) return finish(null, 'скрипт загрузился без ymaps3')
      lib.ready.then(() => finish(lib), () => finish(null, 'ready отклонён'))
    }
    script.onerror = () => finish(null, 'скрипт не загрузился')
    document.head.appendChild(script)
  })

  return ymapsPromise
}
