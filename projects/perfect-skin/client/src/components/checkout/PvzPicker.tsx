import { useEffect, useId, useRef, useState } from 'react'
import { getPoints, type PickupPoint } from '@/lib/delivery-api'

interface PvzPickerProps {
  cityCode: number
  value: PickupPoint | null
  onChange: (point: PickupPoint) => void
}

type Status = 'loading' | 'ready' | 'error'

interface PointsList {
  cityCode: number
  items: PickupPoint[]
  total: number
}

const INPUT_CLASS =
  'w-full px-4 py-3 text-base rounded-block border bg-background text-foreground placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/25 min-h-11'

export function PvzPicker({ cityCode, value, onChange }: PvzPickerProps) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [list, setList] = useState<PointsList | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreFailed, setMoreFailed] = useState(false)
  const [editing, setEditing] = useState(value === null)
  const [retryKey, setRetryKey] = useState(0)
  const latest = useRef({ cityCode, query: debouncedQuery })

  useEffect(() => {
    latest.current = { cityCode, query: debouncedQuery }
  }, [cityCode, debouncedQuery])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setMoreFailed(false)
    getPoints(cityCode, debouncedQuery, 0)
      .then((page) => {
        if (cancelled) return
        setList({ cityCode, items: page.items, total: page.total })
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [cityCode, debouncedQuery, retryKey])

  const isCurrent = (request: { cityCode: number; query: string }) =>
    latest.current.cityCode === request.cityCode && latest.current.query === request.query

  const showMore = async () => {
    if (!list || loadingMore) return
    const request = { cityCode, query: debouncedQuery }
    setLoadingMore(true)
    setMoreFailed(false)
    try {
      const page = await getPoints(request.cityCode, request.query, list.items.length)
      if (!isCurrent(request)) return
      setList((prev) => {
        if (!prev || prev.cityCode !== request.cityCode) return prev
        const known = new Set(prev.items.map((point) => point.code))
        const fresh = page.items.filter((point) => !known.has(point.code))
        return { cityCode: prev.cityCode, items: [...prev.items, ...fresh], total: page.total }
      })
    } catch {
      if (isCurrent(request)) setMoreFailed(true)
    } finally {
      setLoadingMore(false)
    }
  }

  if (value !== null && !editing) {
    return (
      <div className="flex items-start justify-between gap-4 p-4 border border-primary rounded-block bg-primary/5">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">
            {value.name}
            {value.type === 'POSTAMAT' && <span className="ml-2 text-xs text-muted-foreground">Постамат</span>}
          </p>
          <p className="text-body-sm text-muted-foreground">{value.address}</p>
          {value.workTime && <p className="text-body-sm text-muted-foreground">{value.workTime}</p>}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 px-4 py-2 text-sm font-semibold text-primary underline underline-offset-4 min-h-11"
        >
          Изменить
        </button>
      </div>
    )
  }

  const items = list?.cityCode === cityCode ? list.items : []
  const total = list?.cityCode === cityCode ? list.total : 0

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${id}-search`} className="block text-sm font-semibold text-foreground mb-2">
          Пункт выдачи
        </label>
        <input
          id={`${id}-search`}
          type="search"
          autoComplete="off"
          placeholder="Улица, метро или название пункта"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      {status === 'loading' && items.length === 0 && (
        <p aria-live="polite" className="text-body-sm text-muted-foreground">Загружаем пункты…</p>
      )}

      {status === 'error' && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-block border border-border-strong">
          <p className="text-body-sm text-foreground">СДЭК временно недоступен</p>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="shrink-0 px-4 py-2 text-sm font-semibold text-primary underline underline-offset-4 min-h-11"
          >
            Повторить
          </button>
        </div>
      )}

      {status === 'ready' && items.length === 0 && (
        <p aria-live="polite" className="text-body-sm text-muted-foreground">Ничего не найдено. Измените запрос</p>
      )}

      {status !== 'error' && items.length > 0 && (
        <div
          role="radiogroup"
          aria-label="Пункты выдачи"
          aria-busy={status === 'loading'}
          className={`grid gap-2 transition-opacity ${status === 'loading' ? 'opacity-60' : ''}`}
        >
          {items.map((point) => (
            <label
              key={point.code}
              className="flex items-start gap-3 p-3 min-h-11 border border-border rounded-block cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name={`${id}-point`}
                value={point.code}
                checked={value?.code === point.code}
                onChange={() => {
                  onChange(point)
                  setEditing(false)
                }}
                onClick={() => {
                  if (value?.code === point.code) setEditing(false)
                }}
                className="mt-1 w-5 h-5 accent-primary"
              />
              <span className="min-w-0">
                <span className="block font-semibold text-foreground">
                  {point.name}
                  {point.type === 'POSTAMAT' && <span className="ml-2 text-xs text-muted-foreground">Постамат</span>}
                </span>
                <span className="block text-body-sm text-muted-foreground">{point.address}</span>
                {point.workTime && <span className="block text-body-sm text-muted-foreground">{point.workTime}</span>}
              </span>
            </label>
          ))}
        </div>
      )}

      {status === 'ready' && items.length < total && (
        <div>
          <button
            type="button"
            onClick={showMore}
            disabled={loadingMore}
            className="px-4 py-2 text-sm font-semibold text-primary underline underline-offset-4 min-h-11 disabled:opacity-60"
          >
            {loadingMore ? 'Загружаем…' : 'Показать ещё'}
          </button>
          {moreFailed && (
            <p aria-live="polite" className="text-body-sm text-destructive">
              Не удалось загрузить пункты. Попробуйте ещё раз
            </p>
          )}
        </div>
      )}
    </div>
  )
}
