import { Link } from 'react-router-dom'
import { IconClose } from '@/components/icons'
import { useEffect } from 'react'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scroll-lock'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

const navItems = [
  { label: 'Каталог', href: '/catalog' },
  { label: 'Мои заказы', href: '/orders' },
  { label: 'Бренды', href: '/brands' },
  { label: 'Специалистам', href: '/pro' },
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

  // Общий замок прокрутки (со счётчиком), чтобы не спорить с поиском и шторками
  useEffect(() => {
    if (!isOpen) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-foreground/40 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer. Обёртка overflow-hidden: сдвинутая за экран шторка
          иначе растягивает страницу и даёт горизонтальный скролл. */}
      <div
        className="fixed inset-0 z-50 overflow-hidden pointer-events-none"
        aria-hidden={!isOpen}
      >
      <div
        className={`absolute right-0 top-0 bottom-0 w-[calc(100%-48px)] max-w-sm bg-background shadow-lg transform transition-transform duration-300 ease-out ${isOpen ? 'pointer-events-auto' : ''} ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
          <button
            onClick={onClose}
            className="absolute top-[calc(env(safe-area-inset-top)+1rem)] right-4 w-11 h-11 flex items-center justify-center text-foreground hover:bg-muted rounded-full transition-colors duration-200 focus-visible:outline-ring"
            aria-label="Закрыть меню"
          >
            <IconClose />
          </button>

          <nav className="flex flex-col mt-10">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="font-heading font-semibold text-[1.125rem] text-foreground hover:text-primary active:text-primary transition-colors duration-200 focus-visible:outline-ring py-3 border-b border-border/70 last:border-b-0"
                onClick={onClose}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-border mt-6 pt-6">
            <p className="text-label font-sans font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Связаться с нами
            </p>
            <a
              href="tel:+74951832848"
              className="text-body-sm font-sans text-foreground hover:text-primary transition-colors duration-200 focus-visible:outline-ring flex items-center min-h-11"
            >
              +7 (495) 183-28-48
            </a>
            <a
              href="mailto:mail@perfect-skin.shop"
              className="text-body-sm font-sans text-foreground hover:text-primary transition-colors duration-200 focus-visible:outline-ring flex items-center min-h-11"
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
