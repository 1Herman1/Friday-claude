import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { IconSearch, IconClose } from '@/components/icons'
import { useProductSearch } from '@/hooks/useProductSearch'
import { useDrawer } from '@/context/DrawerContext'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scroll-lock'
import { formatPrice } from '@/lib/format'

interface SearchModalProps {
  open: boolean
  onClose: () => void
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const navigate = useNavigate()
  const { query, setQuery, results, popular, loadPopular, isLoading, clear } = useProductSearch()
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isVisible, setIsVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { openQuiz } = useDrawer()

  // Загружаем популярное при открытии модалки
  useEffect(() => {
    if (open) {
      setIsVisible(true)
      loadPopular()
      lockBodyScroll()
      // Фокус на инпут после анимации
      setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    }
  }, [open, loadPopular])

  // Закрытие по Escape
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < (results.length > 0 ? results.length : popular.length) - 1
            ? prev + 1
            : prev
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (selectedIndex >= 0) {
          const items = query.trim() ? results : popular
          const product = items[selectedIndex]
          if (product) {
            handleClose()
            navigate(`/product/${product.slug}`)
          }
        } else if (query.trim()) {
          handleViewAll()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, query, results, popular, selectedIndex, navigate])

  const handleClose = () => {
    setIsVisible(false)
    unlockBodyScroll()
    setTimeout(() => {
      onClose()
      clear()
      setSelectedIndex(-1)
    }, 150)
  }

  const handleViewAll = () => {
    handleClose()
    navigate(`/catalog/all?q=${encodeURIComponent(query.trim())}`)
  }

  const handleProductClick = (slug: string) => {
    handleClose()
    navigate(`/product/${slug}`)
  }

  const handleQuiz = () => {
    handleClose()
    openQuiz()
  }

  const items = query.trim() ? results : popular
  const showEmpty = query.trim() && results.length === 0
  const showNoConnection = isLoading && results.length === 0 && query.trim().length >= 2

  return createPortal(
    <>
      {/* Backdrop */}
      {open && (
        <div
          className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-150 ${
            isVisible ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Modal */}
      <div
        className={`fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-24 pointer-events-none transition-opacity duration-150 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-title"
      >
        <div
          className="pointer-events-auto w-full max-w-xl mx-4 bg-background rounded-lg shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <IconSearch className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedIndex(-1)
              }}
              placeholder="Название, бренд или задача…"
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-base"
              autoComplete="off"
              aria-label="Поиск товаров"
            />
            {query && (
              <button
                onClick={clear}
                className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                aria-label="Очистить поиск"
              >
                <IconClose className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {/* Empty State */}
            {showEmpty && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground mb-4">Ничего не нашлось</p>
                <button
                  onClick={handleQuiz}
                  className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  Подобрать уход
                </button>
              </div>
            )}

            {/* No Connection */}
            {showNoConnection && (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-muted-foreground">Нет соединения</p>
              </div>
            )}

            {/* Results or Popular */}
            {!showEmpty && !showNoConnection && items.length > 0 && (
              <div className="divide-y divide-border">
                {items.map((product, index) => (
                  <button
                    key={product.id}
                    onClick={() => handleProductClick(product.slug)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors text-left ${
                      selectedIndex === index ? 'bg-muted' : ''
                    }`}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    {/* Product Image */}
                    <div className="w-12 h-12 flex-shrink-0 rounded-media bg-muted overflow-hidden">
                      <img
                        src={
                          product.image
                            ? `/products-optimized/${product.slug}/card.webp`
                            : product.image || ''
                        }
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          if (product.image) {
                            ;(e.target as HTMLImageElement).src = product.image
                          }
                        }}
                      />
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {product.name}
                      </p>
                      {product.brand && (
                        <p className="text-xs text-muted-foreground truncate">
                          {product.brand.name}
                        </p>
                      )}
                      <p className="text-xs text-primary font-semibold mt-1">
                        {formatPrice(product.minPrice)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* View All Button */}
            {query.trim() && results.length > 0 && (
              <div className="px-4 py-3 border-t border-border">
                <button
                  onClick={handleViewAll}
                  className="w-full py-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  Все результаты ({results.length})
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
