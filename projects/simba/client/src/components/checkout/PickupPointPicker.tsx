import { useEffect, useMemo, useRef, useState } from 'react'
import type { PickupPoint, PickupPointProvider } from '@simba/shared'
import { deliveryApi } from '../../lib/api'
import { CheckIcon, SearchIcon } from '../icons'
import { hasYandexMapsKey, loadYandexMaps, type LngLat, type YMap, type YMaps } from '../../lib/yandex-maps'

/**
 * Выбор пункта выдачи: список и карта.
 *
 * Карта — Яндекс.Карты v3, и она необязательна: без ключа сборки, без сети
 * или с плохим ключом её нет вовсе, а список занимает всю ширину. Никакого
 * пустого блока «здесь могла быть карта» — так решил владелец.
 */

interface Props {
  provider: PickupPointProvider
  city: string
  cityCoords?: { lat: number; lon: number }
  selected: PickupPoint | null
  onSelect(point: PickupPoint): void
  /** Для стендов и тестов: свой источник точек вместо API. */
  loadPoints?: () => Promise<PickupPoint[]>
}

type PointsState = 'loading' | 'ready' | 'empty' | 'error'
type MapLib = 'none' | 'loading' | 'ready' | 'failed'

/// Цвета меток — из палитры MASTER.md: primary для СДЭК, amber-500 для Яндекса, navy-500 для Ozon,
/// navy-900 — кольцо выбранной. Инлайн, потому что метка живёт в DOM карты, а
/// не в дереве React, и классы Tailwind туда не доезжают.
const MARKER_COLOR: Record<PickupPointProvider, string> = { cdek: '#3A6FE0', yandex: '#E8921A', ozon: '#4A5C7A' }
const SELECTED_RING = '#16233C'

/// Больше этого числа меток на карте — рисуем только те, что в кадре.
const VIEWPORT_ONLY_ABOVE = 300

export function PickupPointPicker({ provider, city, cityCoords, selected, onSelect, loadPoints }: Props) {
  const [points, setPoints] = useState<PickupPoint[]>([])
  const [pointsState, setPointsState] = useState<PointsState>('loading')
  const [retry, setRetry] = useState(0)
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState<PickupPoint | null>(selected)
  const [mapLib, setMapLib] = useState<MapLib>(hasYandexMapsKey() ? 'loading' : 'none')
  const [mobileTab, setMobileTab] = useState<'list' | 'map'>('list')

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const ymapsRef = useRef<YMaps | null>(null)
  const mapRef = useRef<YMap | null>(null)
  const markersRef = useRef<Map<string, { marker: unknown; element: HTMLElement }>>(new Map())
  const shownRef = useRef<Set<string>>(new Set())

  // Выбор снаружи (например, восстановленный из черновика заказа) — в список.
  useEffect(() => {
    setCurrent(selected)
  }, [selected])

  // Библиотека карт — один раз на страницу. Без ключа сюда даже не заходим.
  useEffect(() => {
    if (mapLib !== 'loading') return
    let alive = true
    loadYandexMaps().then((lib) => {
      if (!alive) return
      ymapsRef.current = lib
      setMapLib(lib ? 'ready' : 'failed')
    })
    return () => {
      alive = false
    }
  }, [mapLib])

  // Точки — при смене службы, города или по кнопке «ещё раз».
  const lat = cityCoords?.lat
  const lon = cityCoords?.lon
  useEffect(() => {
    let alive = true
    setPointsState('loading')

    const request = loadPoints
      ? loadPoints()
      : deliveryApi
          .pickupPoints({ provider, city, lat, lon })
          .then((res) => res.data.points)

    request
      .then((data) => {
        if (!alive) return
        setPoints(data)
        setPointsState(data.length ? 'ready' : 'empty')
      })
      .catch(() => {
        if (alive) setPointsState('error')
      })

    return () => {
      // Ответ на устаревший запрос (покупатель уже сменил город) не должен
      // перекрыть свежий.
      alive = false
    }
  }, [provider, city, lat, lon, retry, loadPoints])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return points
    return points.filter((p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q))
  }, [points, query])

  const hasMap = mapLib === 'loading' || mapLib === 'ready'

  // Экземпляр карты: библиотека готова, контейнер на месте, точки известны.
  useEffect(() => {
    const ymaps = ymapsRef.current
    const container = mapContainerRef.current
    if (mapLib !== 'ready' || !ymaps || !container || pointsState !== 'ready') return

    const center: LngLat = lat !== undefined && lon !== undefined ? [lon, lat] : centerOf(points)
    const map = new ymaps.YMap(container, { location: { center, zoom: 11 }, showScaleInCopyrights: true })
    map.addChild(new ymaps.YMapDefaultSchemeLayer())
    map.addChild(new ymaps.YMapDefaultFeaturesLayer())

    const markers = new Map<string, { marker: unknown; element: HTMLElement }>()
    for (const point of points) {
      const element = markerElement(MARKER_COLOR[point.provider])
      const marker = new ymaps.YMapMarker(
        {
          coordinates: [point.lon, point.lat],
          onClick: () => {
            setCurrent(point)
            listRef.current
              ?.querySelector<HTMLElement>(`[data-code="${CSS.escape(point.code)}"]`)
              ?.scrollIntoView({ block: 'nearest' })
          },
        },
        element
      )
      markers.set(point.code, { marker, element })
    }
    markersRef.current = markers

    const shown = new Set<string>()
    shownRef.current = shown
    const syncViewport = () => {
      if (points.length <= VIEWPORT_ONLY_ABOVE) {
        for (const [code, { marker }] of markers) {
          if (!shown.has(code)) {
            map.addChild(marker)
            shown.add(code)
          }
        }
        return
      }
      const [[west, south], [east, north]] = normalizeBounds(map.bounds)
      for (const point of points) {
        const entry = markers.get(point.code)
        if (!entry) continue
        const inside = point.lon >= west && point.lon <= east && point.lat >= south && point.lat <= north
        if (inside && !shown.has(point.code)) {
          map.addChild(entry.marker)
          shown.add(point.code)
        } else if (!inside && shown.has(point.code)) {
          map.removeChild(entry.marker)
          shown.delete(point.code)
        }
      }
    }

    let throttle: ReturnType<typeof setTimeout> | undefined
    map.addChild(
      new ymaps.YMapListener({
        onUpdate: () => {
          clearTimeout(throttle)
          throttle = setTimeout(syncViewport, 150)
        },
      })
    )
    syncViewport()
    mapRef.current = map

    return () => {
      clearTimeout(throttle)
      map.destroy()
      mapRef.current = null
      markersRef.current = new Map()
      shownRef.current = new Set()
    }
    // Зависимости — числа, а не объект координат: новый объект на каждый
    // рендер родителя пересоздавал бы карту при наборе текста в соседнем поле.
  }, [mapLib, pointsState, points, lat, lon])

  // Выбранная метка крупнее и с тёмным кольцом; остальные — обычные.
  useEffect(() => {
    for (const [code, { element }] of markersRef.current) {
      styleMarker(element, MARKER_COLOR[provider], code === current?.code)
    }
    if (current && mapRef.current) {
      mapRef.current.setLocation({ center: [current.lon, current.lat], duration: 250 })
    }
  }, [current, provider, mapLib])

  if (pointsState === 'loading') {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Загружаем пункты выдачи">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-blue-50 animate-pulse" />
        ))}
      </div>
    )
  }

  if (pointsState === 'empty') {
    return (
      <div className="rounded-xl border border-line bg-white p-6 text-center">
        <p className="font-semibold text-navy-900">В этом городе пока нет пунктов выдачи</p>
        <p className="mt-1 text-sm text-navy-500">Выберите другой способ доставки</p>
      </div>
    )
  }

  if (pointsState === 'error') {
    return (
      <div className="rounded-xl border border-destructive bg-white p-6 text-center">
        <p className="text-sm text-destructive">Не удалось получить список пунктов выдачи</p>
        <button
          type="button"
          onClick={() => setRetry((n) => n + 1)}
          className="mt-3 btn-primary px-6"
        >
          Попробовать ещё раз
        </button>
      </div>
    )
  }

  const showList = !hasMap || mobileTab === 'list'
  const showMap = hasMap && mobileTab === 'map'

  return (
    <div className="space-y-4">
      {hasMap && (
        <div className="flex gap-2 md:hidden" aria-label="Вид пунктов выдачи">
          {(['list', 'map'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={mobileTab === tab}
              onClick={() => setMobileTab(tab)}
              className={`h-11 flex-1 rounded-xl text-sm font-semibold transition-colors duration-100 ease-smooth ${
                mobileTab === tab ? 'bg-primary text-white' : 'border border-line bg-white text-navy-700'
              }`}
            >
              {tab === 'list' ? 'Список' : 'Карта'}
            </button>
          ))}
        </div>
      )}

      <div className={hasMap ? 'md:flex md:gap-4 md:h-[420px]' : ''}>
        <div
          className={`flex flex-col ${hasMap ? 'md:w-2/5 md:max-h-full' : ''} ${showList ? '' : 'max-md:hidden'}`}
        >
          {/* Поиск — с лупой и своей подписью: без них поле читалось как ещё
              одно поле адреса рядом с городом. */}
          <label htmlFor="pickup-search" className="sr-only">
            Найти пункт по адресу или названию
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-navy-400" />
            <input
              id="pickup-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти пункт по адресу"
              className="h-11 w-full rounded-lg border border-line pl-9 pr-3 text-sm text-navy-900 placeholder:text-navy-400"
            />
          </div>
          <p className="mt-2 text-xs text-navy-500" aria-live="polite">
            {filtered.length === points.length
              ? `Пунктов в городе: ${points.length}`
              : `Найдено: ${filtered.length} из ${points.length}`}
          </p>

          <div ref={listRef} className={`mt-2 ${hasMap ? 'md:flex-1 md:overflow-y-auto' : ''} max-h-[420px] overflow-y-auto border-t border-line`}>
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-navy-500">По такому адресу пунктов нет</p>
            ) : (
              <div role="listbox" aria-label="Пункты выдачи" className="divide-y divide-line">
                {filtered.map((point) => {
                  const active = current?.code === point.code
                  return (
                    <button
                      key={point.code}
                      type="button"
                      role="option"
                      aria-selected={active}
                      data-code={point.code}
                      onClick={() => {
                        setCurrent(point)
                        // Без карты второй шаг «Выбрать этот пункт» не нужен: кнопка
                        // стояла под длинным списком, за краем экрана телефона.
                        if (!hasMap) onSelect(point)
                      }}
                      className={`flex w-full min-h-[44px] items-start gap-3 p-3 text-left transition-colors duration-100 ease-smooth ${
                        active ? 'bg-primary-tint' : 'hover:bg-blue-50'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-navy-900">{point.name}</span>
                        <span className="block text-sm text-navy-500">{point.address}</span>
                        {point.workTime && <span className="block text-xs text-navy-500">{point.workTime}</span>}
                      </span>
                      {active && <CheckIcon className="mt-1 w-4 h-4 flex-shrink-0 text-amber-600" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {hasMap && (
          <div
            className={`relative mt-4 h-[360px] overflow-hidden rounded-xl border border-line md:mt-0 md:h-full md:w-3/5 ${
              showMap ? '' : 'max-md:hidden'
            }`}
          >
            <div ref={mapContainerRef} className="h-full w-full" />
            {mapLib === 'loading' && (
              <div className="absolute inset-0 animate-pulse bg-blue-50" aria-hidden="true" />
            )}
          </div>
        )}
      </div>

      {current && (
        <div className="rounded-xl bg-primary-tint p-4">
          <p className="font-semibold text-navy-900">{current.name}</p>
          <p className="mt-1 text-sm text-navy-700">{current.address}</p>
          {current.workTime && <p className="mt-1 text-sm text-navy-500">{current.workTime}</p>}
          {current.phone && (
            <a href={`tel:${current.phone}`} className="mt-1 block text-sm text-primary-hover">
              {current.phone}
            </a>
          )}
          {current.code === selected?.code ? (
            <p className="mt-3 flex h-11 items-center gap-2 text-sm font-semibold text-success">
              <CheckIcon className="w-4 h-4" aria-hidden="true" />
              Пункт выбран
            </p>
          ) : (
            <button
              type="button"
              onClick={() => onSelect(current)}
              className="mt-3 w-full btn-primary"
            >
              Выбрать этот пункт
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function centerOf(points: PickupPoint[]): LngLat {
  const lats = points.map((p) => p.lat)
  const lons = points.map((p) => p.lon)
  return [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2]
}

function normalizeBounds([a, b]: [LngLat, LngLat]): [LngLat, LngLat] {
  return [
    [Math.min(a[0], b[0]), Math.min(a[1], b[1])],
    [Math.max(a[0], b[0]), Math.max(a[1], b[1])],
  ]
}

/** Метка — DOM-элемент: у Яндекс.Карт v3 содержимое метки это HTMLElement, не JSX. */
function markerElement(color: string): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = 'width:28px;height:28px;cursor:pointer'
  el.style.transition = 'transform 100ms'
  el.innerHTML =
    '<svg viewBox="0 0 28 28" width="100%" height="100%" aria-hidden="true">' +
    '<circle data-ring cx="14" cy="14" r="12" fill="none" stroke-width="1.5" opacity="0.35"/>' +
    '<circle data-dot cx="14" cy="14" r="7"/>' +
    '<circle cx="14" cy="14" r="3" fill="#fff"/></svg>'
  styleMarker(el, color, false)
  return el
}

function styleMarker(el: HTMLElement, color: string, selected: boolean) {
  // Рост через transform, а не width/height: размер не трогает layout карты.
  el.style.transform = `translate(-50%, -50%) scale(${selected ? 1.3 : 1})`
  el.style.zIndex = selected ? '1' : '0'
  const ring = el.querySelector<SVGElement>('[data-ring]')
  const dot = el.querySelector<SVGElement>('[data-dot]')
  ring?.setAttribute('stroke', selected ? SELECTED_RING : color)
  ring?.setAttribute('opacity', selected ? '1' : '0.35')
  ring?.setAttribute('stroke-width', selected ? '2.5' : '1.5')
  dot?.setAttribute('fill', color)
}
