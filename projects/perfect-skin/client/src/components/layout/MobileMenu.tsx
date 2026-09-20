import { Link } from 'react-router-dom'
import { IconClose } from '@/components/icons'
import { useEffect } from 'react'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

const navItems = [
  { label: 'Каталог', href: '/catalog' },
  { label: 'Мои заказы', href: '/orders' },
  { label: 'Бренды', href: '/brands' },
  { label: 'О компании', href: '/about' },
  { label: 'Контакты', href: '/contacts' },
]

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  // Закрытие по Escape — стандарт для модальных шторок.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer. Обёртка overflow-hidden: сдвинутая за экран шторка
          иначе растягивает страницу и даёт горизонтальный скролл. */}
      <div
        className="fixed inset-0 z-50 overflow-hidden pointer-events-none"
        aria-hidden={!isOpen}
      >
      <div
        className={`absolute right-0 top-0 bottom-0 w-full max-w-sm bg-card shadow-lg transform transition-transform duration-300 ${isOpen ? 'pointer-events-auto' : ''} ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center text-foreground hover:bg-muted rounded-full transition-colors duration-200 focus-visible:outline-ring"
            aria-label="Закрыть меню"
          >
            <IconClose />
          </button>

          <nav className="flex flex-col gap-1 mt-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="text-body font-sans text-foreground hover:text-primary transition-colors duration-200 focus-visible:outline-ring py-0.5"
                onClick={onClose}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-border mt-8 pt-8">
            <p className="text-label font-sans font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Контакты
            </p>
            <a
              href="tel:+74951832848"
              className="text-body-sm font-sans text-foreground hover:text-primary transition-colors duration-200 focus-visible:outline-ring block"
            >
              +7 (495) 183-28-48
            </a>
            <a
              href="mailto:mail@perfect-skin.shop"
              className="text-body-sm font-sans text-foreground hover:text-primary transition-colors duration-200 focus-visible:outline-ring block mt-2"
            >
              mail@perfect-skin.shop
            </a>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}
