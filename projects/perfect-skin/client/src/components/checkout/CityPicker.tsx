import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { getCities, type CityOption } from '@/lib/delivery-api'
import { IconSearch } from '@/components/icons'

export const CITY_STORAGE_KEY = 'ps_checkout_city'

export function readStoredCity(): CityOption | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CITY_STORAGE_KEY) ?? 'null') as CityOption | null
    return parsed && typeof parsed.code === 'number' && typeof parsed.name === 'string' ? parsed : null
  } catch {
    return null
  }
}

interface CityPickerProps {
  value: CityOption | null
  onChange: (city: CityOption) => void
}

const INPUT_CLASS =
  'w-full px-4 py-3 text-base rounded-block border bg-background text-foreground placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/25 min-h-11'

export function CityPicker({ value, onChange }: CityPickerProps) {
  const id = useId()
  const [text, setText] = useState(value?.name ?? '')
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<CityOption[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setOptions([])
      setOpen(false)
      setLoading(false)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setOpen(true)
      setFailed(false)
      try {
        const items = await getCities(q)
        if (cancelled) return
        setOptions(items)
        setActive(items.length > 0 ? 0 : -1)
      } catch {
        if (cancelled) return
        setOptions([])
        setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  const showOptions = !loading && options.length > 0

  const select = (city: CityOption) => {
    try {
      localStorage.setItem(CITY_STORAGE_KEY, JSON.stringify(city))
    } catch {
      // Хранилище недоступно (приватный режим) — выбор всё равно применяем
    }
    onChange(city)
    setText(city.name)
    setQuery('')
    setOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (event.key === 'ArrowDown' && options.length > 0) {
        event.preventDefault()
        setOpen(true)
      }
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => Math.min(i + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter' && showOptions && active >= 0 && options[active]) {
      event.preventDefault()
      select(options[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const listId = `${id}-list`
  const optionId = (index: number) => `${id}-option-${index}`
  const statusText = loading ? 'Ищем…' : failed ? 'СДЭК временно недоступен. Попробуйте позже' : 'Город не найден'

  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="block text-sm font-semibold text-foreground mb-2">
        Город доставки
      </label>
      <div className="relative">
        <input
          id={`${id}-input`}
          role="combobox"
          type="text"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={showOptions ? listId : undefined}
          aria-activedescendant={showOptions && active >= 0 ? optionId(active) : undefined}
          placeholder="Например: Москва"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setQuery(e.target.value)
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            setOpen(false)
            setText(value?.name ?? '')
            setQuery('')
          }}
          className={`${INPUT_CLASS} pr-11`}
        />
        <IconSearch className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-block shadow-md p-1">
          {showOptions && (
            <ul id={listId} role="listbox" aria-label="Найденные города" className="max-h-64 overflow-auto">
              {options.map((city, index) => (
                <li
                  key={city.code}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    select(city)
                  }}
                  className={`flex items-center min-h-11 px-3 rounded-md cursor-pointer text-foreground ${index === active ? 'bg-muted' : ''}`}
                >
                  {city.name}
                </li>
              ))}
            </ul>
          )}
          {!showOptions && (
            <p aria-live="polite" className="px-3 py-3 text-body-sm text-muted-foreground">
              {statusText}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
