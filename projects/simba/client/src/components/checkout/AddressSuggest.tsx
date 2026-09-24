import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { AddressSuggestion } from '@simba/shared'
import { addressApi } from '../../lib/api'
import { createDebouncedAsync } from '../../lib/debounce'
import { ChevronDownIcon } from '../icons'

interface Props {
  value: string
  onChange(text: string): void
  onSelect(suggestion: AddressSuggestion): void
  error?: string
  id: string
}

export default function AddressSuggest({
  value,
  onChange,
  onSelect,
  error,
  id,
}: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Номер последнего отправленного запроса: ответ на более ранний, пришедший
  // позже, не должен перекрыть свежие подсказки.
  const lastRequestRef = useRef(0)

  // Debounce поиска
  const debouncedFetch = useMemo(
    () =>
      createDebouncedAsync(
        async (query: string) => {
          if (query.length < 3) {
            setSuggestions([])
            setIsOpen(false)
            return
          }

          setIsLoading(true)

          const requestNo = ++lastRequestRef.current
          try {
            const response = await addressApi.suggest(query)
            if (requestNo !== lastRequestRef.current) return
            setSuggestions(response.data.suggestions)
            setIsOpen(true)
            setActiveIndex(-1)
          } catch {
            // Ошибка сети — просто закрываем список, не мешаем пользователю
            setSuggestions([])
            setIsOpen(false)
            } finally {
            setIsLoading(false)
          }
        },
        300
      ),
    []
  )

  // При изменении value — запрос подсказок
  useEffect(() => {
    const trimmed = value.trim()
    if (trimmed === '') {
      setSuggestions([])
      setIsOpen(false)
      setActiveIndex(-1)
    } else {
      debouncedFetch(trimmed)
    }
  }, [value, debouncedFetch])

  useEffect(() => () => debouncedFetch.cancel(), [debouncedFetch])

  // Обработчик клавиатуры
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          handleSelectItem(suggestions[activeIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        break
    }
  }

  // Выбор предложения
  const handleSelectItem = useCallback(
    (suggestion: AddressSuggestion) => {
      onSelect(suggestion)
      setSuggestions([])
      setIsOpen(false)
      setActiveIndex(-1)
    },
    [onSelect]
  )

  // Клик по пункту списка
  const handleItemClick = (suggestion: AddressSuggestion) => {
    handleSelectItem(suggestion)
  }

  // Фокус на активный пункт
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]')
      const activeItem = items[activeIndex]
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [activeIndex])

  // Закрытие по клику вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const listId = `${id}-listbox`
  const activedescendant =
    activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="block text-sm font-medium text-navy-900 mb-2">
        Адрес доставки
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= 3 && setIsOpen(true)}
          placeholder="Город, улица, дом"
          role="combobox"
          aria-autocomplete="list"
          aria-label="Адрес доставки"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-activedescendant={activedescendant}
          aria-invalid={!!error}
          className={`w-full px-4 py-3 rounded-xl border bg-white text-navy-900 placeholder-navy-500 text-base transition-colors focus:outline-none focus:ring-2 focus:ring-primary-soft ${
            error
              ? 'border-destructive focus:border-destructive'
              : 'border-line focus:border-primary-soft'
          }`}
        />

        {/* Индикатор загрузки или выпадающей стрелки */}
        {isLoading ? (
          <div
            data-layout-transform className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-navy-300 border-t-primary rounded-full animate-spin"
            aria-hidden="true"
          />
        ) : (
          <ChevronDownIcon
            data-layout-transform className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-300 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Ошибка валидации */}
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}

      {/* Выпадающий список */}
      {isOpen && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-line rounded-xl shadow-lg max-h-80 overflow-y-auto"
        >
          {suggestions.length === 0 && !isLoading && (
            <li className="px-4 py-3 text-navy-500 text-sm">
              {value.trim().length > 0 ? 'Ничего не найдено' : 'Начните вводить адрес'}
            </li>
          )}

          {isLoading && (
            <li className="px-4 py-3 text-navy-500 text-sm">Ищем…</li>
          )}

          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.value}-${index}`}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={activeIndex === index}
              onClick={() => handleItemClick(suggestion)}
              className={`px-4 py-3 cursor-pointer transition-colors min-h-11 flex flex-col justify-center ${
                activeIndex === index
                  ? 'bg-blue-50 text-navy-900'
                  : 'text-navy-900 hover:bg-blue-50'
              }`}
            >
              <div className="font-medium text-sm">{suggestion.value}</div>
              {!suggestion.complete && (
                <div className="text-xs text-navy-500 mt-0.5">Уточните дом</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
