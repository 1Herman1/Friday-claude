import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, Link } from 'react-router-dom'
import { useProductSearch } from '../../hooks/useProductSearch'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/scroll-lock'
import { PawIcon, CloseIcon, SearchIcon } from '../icons'
import { formatPrice } from '../../lib/format'
import LottieScene from '../LottieScene'

const EXIT_MS = 150

const QUICK_LINKS = [
  { label: 'Корм для кошек', href: '/catalog?category=cats-food' },
  { label: 'Корм для собак', href: '/catalog?category=dogs-food' },
  { label: 'Лакомства', href: '/catalog?category=treats' },
]

const loadEmptyDog = () => import('../../lottie/empty-catalog.json')

function pluralize(n: number, one: string, few: string, many: string): string {
  if (n % 10 === 1 && n % 100 !== 11) return one
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return few
  return many
}

type Props = {
  open: boolean
  onClose: () => void
}

export default function SearchModal({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const {
    value,
    setValue,
    results,
    popular,
    loadPopular,
    loading,
    selectedIndex,
    setSelectedIndex,
    total,
    clear,
    reset,
  } = useProductSearch()

  // Mount/exit логика как в WelcomeBonusPopup
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement
      setMounted(true)
      // Загружаем популярные при открытии
      loadPopular()
      // rAF перед включением классов
      const raf = requestAnimationFrame(() => {
        setShown(true)
        inputRef.current?.focus({ preventScroll: true })
      })
      return () => cancelAnimationFrame(raf)
    }

    setShown(false)
    const timer = setTimeout(() => {
      setMounted(false)
      returnFocusRef.current?.focus()
      reset()
    }, EXIT_MS)
    return () => clearTimeout(timer)
  }, [open, loadPopular, reset])

  // Фокус-трап и обработчик Escape
  useEffect(() => {
    if (!mounted) return

    lockBodyScroll()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable || focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      unlockBodyScroll()
    }
  }, [mounted, onClose])

  // Список, по которому реально ходит клавиатура: результаты поиска, если они
  // есть, иначе "Популярное" — оно показано и при пустом поле, и как fallback
  // под "ничего не найдено" (раньше здесь было `value.trim() ? results : popular`,
  // из-за чего при непустом запросе без результатов стрелки/Enter не видели
  // видимый на экране список "Популярное" — он был кликабелен только мышью).
  const activeItems = results.length > 0 ? results : popular

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }

    if (activeItems.length === 0 && e.key !== 'Enter') return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < activeItems.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < activeItems.length) {
        goToProduct(activeItems[selectedIndex])
      } else if (value.trim()) {
        handleSearch(value)
      }
    }
  }

  const goToProduct = (product: typeof results[0]) => {
    navigate(`/product/${product.slug}`)
    onClose()
  }

  const handleSearch = (searchValue: string) => {
    navigate(`/catalog?q=${encodeURIComponent(searchValue)}`)
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      handleSearch(value)
    }
  }

  const handleCategoryClick = (href: string) => {
    navigate(href)
    onClose()
  }

  // Определяем, что показывать в контенте
  const isEmpty = !value.trim()
  const hasResults = results.length > 0
  const showSkeletons = loading && isEmpty && popular.length === 0

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center sm:px-4 sm:pt-[10vh]">
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`absolute inset-0 bg-navy-900/40 supports-[backdrop-filter]:backdrop-blur-sm
                    transition-opacity ease-smooth
                    ${shown ? 'opacity-100 duration-200' : 'opacity-0 duration-150'}`}
      />

      {/* Диалог */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-dialog-title"
        className={`relative flex flex-col w-full bg-white shadow-xl
                    h-[100dvh] rounded-none
                    sm:h-auto sm:max-h-[80vh] sm:max-w-3xl sm:rounded-card sm:border sm:border-line
                    transition-[opacity,transform] ease-smooth
                    ${shown
                      ? 'opacity-100 sm:scale-100 duration-200 sm:duration-[240ms]'
                      : 'opacity-0 sm:scale-[0.96] duration-150 sm:duration-150'}`}
      >
        <h2 id="search-dialog-title" className="sr-only">Поиск по каталогу</h2>

        {/* A. Шапка панели */}
        <div className="flex-shrink-0 flex items-center gap-2 p-3 sm:p-4 border-b border-line
                        pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-4">
          <form onSubmit={handleSubmit} className="relative flex-1">
            <label htmlFor="search-modal-input" className="sr-only">Поиск по каталогу</label>
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-400 pointer-events-none" />
            <input
              id="search-modal-input"
              ref={inputRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              role="combobox"
              aria-expanded="true"
              aria-controls="search-results-list"
              aria-activedescendant={selectedIndex >= 0 ? `search-opt-${selectedIndex}` : undefined}
              placeholder="Найти корм, лакомства, игрушки…"
              className="w-full h-12 sm:h-14 pl-12 pr-12 text-base rounded-xl
                         bg-blue-50 border border-line text-navy-900 placeholder-navy-400
                         focus:bg-white focus:outline-none focus:border-ink focus:ring-2 focus:ring-ink
                         transition-[background-color,border-color,box-shadow] duration-150 ease-smooth"
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {value && (
              <button
                type="button"
                onClick={clear}
                aria-label="Очистить поле"
                className="btn-press absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11
                           flex items-center justify-center text-navy-400 hover:text-navy-700 rounded-full"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            )}
          </form>

          {/* Кнопка закрытия */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть поиск"
            className="btn-press w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full
                       text-navy-500 hover:bg-black/5"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* B. Контент (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* Случай (в): Скелетоны при первой загрузке популярного */}
          {showSkeletons && (
            <div className="p-4 sm:p-6">
              <h3 className="text-sm font-bold text-navy-900 mb-3">Что чаще всего берут</h3>
              <ul
                id="search-results-list"
                role="listbox"
                aria-label="Популярные товары"
                className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4"
              >
                {Array.from({ length: 6 }).map((_, idx) => (
                  <li key={idx} className="animate-pulse">
                    <div className="aspect-square rounded-lg bg-blue-50" />
                    <div className="mt-2 rounded bg-blue-50" style={{ height: '1rem' }} />
                    <div className="mt-1.5 rounded bg-blue-50" style={{ height: '1rem', width: '66%' }} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Случай (а): Пустое поле + популярное + категории */}
          {isEmpty && !showSkeletons && popular.length > 0 && (
            <div className="p-4 sm:p-6">
              <h3 className="text-sm font-bold text-navy-900 mb-3">Что чаще всего берут</h3>
              <ul
                id="search-results-list"
                role="listbox"
                aria-label="Популярные товары"
                className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6"
              >
                {popular.map((product, idx) => (
                  <li
                    key={product.id}
                    role="option"
                    id={`search-opt-${idx}`}
                    aria-selected={idx === selectedIndex}
                    className="animate-card-in"
                    style={{ animationDelay: `${Math.min(idx, 5) * 40}ms` }}
                  >
                    <button
                      type="button"
                      onClick={() => goToProduct(product)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`btn-press press-wide w-full text-left p-2 rounded-xl transition-none
                        ${idx === selectedIndex ? 'bg-primary-tint' : ''}`}
                    >
                      <div className="aspect-square rounded-lg bg-blue-50 flex items-center justify-center overflow-hidden">
                        {product.images[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            loading="lazy"
                            decoding="async"
                            className="max-h-full max-w-full object-contain p-2"
                          />
                        ) : (
                          <PawIcon className="w-10 h-10 text-navy-200" />
                        )}
                      </div>
                      <p className="mt-2 text-xs text-navy-500 truncate">
                        {product.brand?.name ?? ''}
                      </p>
                      <p className="text-sm font-semibold text-navy-900 line-clamp-2 leading-snug">
                        {product.name}
                      </p>
                      <p className="mt-1 text-base font-bold text-navy-900 tabular-nums">
                        {formatPrice(product.variants[0]?.price ?? 0)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>

              <h3 className="text-sm font-bold text-navy-900 mt-6 mb-3">Категории</h3>
              <div className="flex flex-wrap gap-2">
                {QUICK_LINKS.map(link => (
                  <button
                    key={link.href}
                    type="button"
                    onClick={() => handleCategoryClick(link.href)}
                    className="btn-press inline-flex items-center min-h-11 px-4 rounded-full border border-line
                             text-sm font-medium text-navy-700 hover:border-ink hover:bg-white"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Случай (б): Результаты поиска */}
          {!isEmpty && !showSkeletons && hasResults && (
            <div className={`p-4 sm:p-6 transition-opacity duration-150 ease-smooth
                          ${loading ? 'opacity-60' : 'opacity-100'}`}>
              <h3 className="sr-only">Результаты поиска</h3>
              <ul
                id="search-results-list"
                role="listbox"
                aria-label="Результаты поиска"
                className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4"
              >
                {results.map((product, idx) => (
                  <li
                    key={product.id}
                    role="option"
                    id={`search-opt-${idx}`}
                    aria-selected={idx === selectedIndex}
                  >
                    <button
                      type="button"
                      onClick={() => goToProduct(product)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`btn-press press-wide w-full text-left p-2 rounded-xl transition-none
                        ${idx === selectedIndex ? 'bg-primary-tint' : ''}`}
                    >
                      <div className="aspect-square rounded-lg bg-blue-50 flex items-center justify-center overflow-hidden">
                        {product.images[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            loading="lazy"
                            decoding="async"
                            className="max-h-full max-w-full object-contain p-2"
                          />
                        ) : (
                          <PawIcon className="w-10 h-10 text-navy-200" />
                        )}
                      </div>
                      <p className="mt-2 text-xs text-navy-500 truncate">
                        {product.brand?.name ?? ''}
                      </p>
                      <p className="text-sm font-semibold text-navy-900 line-clamp-2 leading-snug">
                        {product.name}
                      </p>
                      <p className="mt-1 text-base font-bold text-navy-900 tabular-nums">
                        {formatPrice(product.variants[0]?.price ?? 0)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Случай (г): Ничего не найдено */}
          {!isEmpty && !showSkeletons && !hasResults && !loading && (
            <>
              <div className="px-6 py-10 text-center">
                <div className="relative w-28 mx-auto">
                  <LottieScene load={loadEmptyDog} className="w-full aspect-[1065/922]" />
                  <svg viewBox="0 0 100 8" aria-hidden="true" focusable="false" className="absolute inset-x-0 bottom-[3%] w-[76%] mx-auto">
                    <ellipse cx="50" cy="4" rx="50" ry="4" className="fill-navy-100" />
                  </svg>
                </div>
                <p className="mt-4 text-lg font-bold text-navy-900">
                  Ничего не нашли по запросу «{value}»
                </p>
                <p className="mt-2 mx-auto max-w-sm text-sm text-navy-500 leading-relaxed">
                  Проверьте раскладку клавиатуры или поищите по названию бренда — а мы пока покажем, что берут
                  чаще всего.
                </p>
                <Link
                  to="/catalog"
                  onClick={onClose}
                  className="btn-primary mt-5 px-6 inline-flex"
                >
                  Открыть каталог
                </Link>
              </div>

              {/* Блок "Что чаще всего берут" под "ничего не найдено" */}
              {popular.length > 0 && (
                <div className="p-4 sm:p-6 border-t border-line">
                  <h3 className="text-sm font-bold text-navy-900 mb-3">Что чаще всего берут</h3>
                  <ul
                    id="search-results-list"
                    role="listbox"
                    aria-label="Популярные товары"
                    className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4"
                  >
                    {popular.map((product, idx) => (
                      <li
                        key={product.id}
                        role="option"
                        id={`search-opt-${idx}`}
                        aria-selected={idx === selectedIndex}
                      >
                        <button
                          type="button"
                          onClick={() => goToProduct(product)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`btn-press press-wide w-full text-left p-2 rounded-xl transition-none
                            ${idx === selectedIndex ? 'bg-primary-tint' : ''}`}
                        >
                          <div className="aspect-square rounded-lg bg-blue-50 flex items-center justify-center overflow-hidden">
                            {product.images[0] ? (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                loading="lazy"
                                decoding="async"
                                className="max-h-full max-w-full object-contain p-2"
                              />
                            ) : (
                              <PawIcon className="w-10 h-10 text-navy-200" />
                            )}
                          </div>
                          <p className="mt-2 text-xs text-navy-500 truncate">
                            {product.brand?.name ?? ''}
                          </p>
                          <p className="text-sm font-semibold text-navy-900 line-clamp-2 leading-snug">
                            {product.name}
                          </p>
                          <p className="mt-1 text-base font-bold text-navy-900 tabular-nums">
                            {formatPrice(product.variants[0]?.price ?? 0)}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Screen reader status */}
              <p className="sr-only" role="status" aria-live="polite">
                Ничего не найдено по запросу {value}
              </p>
            </>
          )}

          {/* Screen reader status для результатов */}
          {!isEmpty && !showSkeletons && (
            <p className="sr-only" role="status" aria-live="polite">
              {hasResults ? `Найдено ${total} ${pluralize(total, 'товар', 'товара', 'товаров')}` : 'Ничего не найдено'}
            </p>
          )}
        </div>

        {/* C. Футер с CTA (только при непустом запросе и total > limit) */}
        {!isEmpty && total > 6 && (
          <div className="flex-shrink-0 border-t border-line p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => handleSearch(value)}
              className="btn-primary w-full"
            >
              Показать все результаты — {pluralize(total, 'товар', 'товара', 'товаров')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
