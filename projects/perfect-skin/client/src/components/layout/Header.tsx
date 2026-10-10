import { useEffect, useRef, useState } from 'react'
import { IconMenu, IconUser, IconSearch, IconPhone } from '@/components/icons'
import { Link, useLocation } from 'react-router-dom'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useDrawer } from '@/context/DrawerContext'
import { useCart } from '@/context/CartContext'
import { useAuth, isApprovedPro, isStaff } from '@/context/AuthContext'
import { useFavorites } from '@/context/FavoritesContext'
import { useScrollDirection } from '@/hooks/useScrollDirection'
import { ContactsPopover } from './ContactsPopover'
import { pluralize } from '@/lib/format'
import { scrollToTopFast } from '@/lib/scroll-top'
import { useScenePinned } from '@/lib/scene-pin'

interface HeaderProps {
  cartIcon?: React.ReactNode
  favoriteIcon?: React.ReactNode
  onMobileMenuOpen?: () => void
  onSearchOpen?: () => void
}

const navItems = [
  { label: 'Каталог', href: '/catalog' },
  { label: 'Бренды', href: '/brands' },
  { label: 'Специалистам', href: '/pro' },
  { label: 'О компании', href: '/about' },
]

export function Header({
  cartIcon,
  favoriteIcon,
  onMobileMenuOpen,
  onSearchOpen,
}: HeaderProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const location = useLocation()
  const { openCart, openFavorites } = useDrawer()
  const { count } = useCart()
  const { count: favCount } = useFavorites()
  const { isAuthed, user } = useAuth()
  const headerRef = useRef<HTMLElement>(null)
  const contactsButtonRef = useRef<HTMLButtonElement>(null)
  const [headerHeight, setHeaderHeight] = useState(72)
  const [contactsOpen, setContactsOpen] = useState(false)
  const [contactsKbd, setContactsKbd] = useState(false)
  const { hidden: hiddenByScroll, scrolled } = useScrollDirection(headerHeight, 8, contactsOpen)
  // Пока клиент внутри сцены «Бестселлеры» — шапки нет
  const scenePinned = useScenePinned()
  const hidden = hiddenByScroll || scenePinned

  useEffect(() => {
    if (!headerRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      const height = headerRef.current?.offsetHeight || 72
      setHeaderHeight(height)
      document.documentElement.style.setProperty('--header-h', `${height}px`)
    })

    resizeObserver.observe(headerRef.current)

    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (contactsOpen) {
      setContactsOpen(false)
    }
  }, [location.pathname])

  return (
    <header
      ref={headerRef}
      // Телефон: iOS — плавающая скруглённая «пилюля» (как панели нового Safari), Android и
      // остальные — прямоугольная полоса. Планшет и компьютер — прежняя стеклянная полоса.
      className={`fixed top-0 inset-x-0 z-40 pt-[env(safe-area-inset-top)] bg-background/70 backdrop-blur-xl backdrop-saturate-150 transition-transform duration-300 max-md:ios:bg-transparent max-md:ios:backdrop-blur-none max-md:ios:backdrop-saturate-100 max-md:ios:px-4 max-md:ios:pt-[calc(env(safe-area-inset-top)+8px)] ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      }`}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.23,1,0.32,1)',
      }}
    >
      <div
        className={`border-b transition-colors duration-200 ${
          scrolled ? 'border-border' : 'border-transparent'
        } max-md:ios:border-b-0 max-md:ios:rounded-full max-md:ios:bg-background/80 max-md:ios:backdrop-blur-xl max-md:ios:backdrop-saturate-150 max-md:ios:shadow-[0_6px_24px_rgba(20,32,46,0.14)] max-md:ios:ring-1 max-md:ios:ring-foreground/5`}
      >
        <div className="container-app py-3 md:py-4 max-md:ios:px-4 max-md:ios:py-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="shrink-0">
              <Link
                to="/"
                className="focus-visible:outline-ring block"
                onClick={(e) => {
                  // На главной логотип — быстрый плавный подъём наверх, а не «телепорт»
                  if (location.pathname === '/') {
                    e.preventDefault()
                    scrollToTopFast()
                  }
                }}
              >
                <img
                  src="/logo/logo-wordmark.webp"
                  alt="Perfect Skin"
                  width={120}
                  height={20}
                  className="h-3.5 min-[380px]:h-4 sm:h-5 md:h-6 w-auto"
                />
              </Link>
              <p className="hidden md:block mt-1 text-[13px] leading-none font-sans font-medium text-foreground/75 text-left whitespace-nowrap">
                Назначают врачи. Любит ваша кожа
              </p>
            </div>

            {isDesktop && (
              <nav className="flex items-center gap-1 xl:gap-2 text-body font-sans ml-6 xl:ml-10">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`relative whitespace-nowrap px-3 py-2 rounded-pill transition-colors duration-200 focus-visible:outline-ring ${
                        isActive
                          ? 'text-primary font-semibold'
                          : 'text-foreground hover:bg-foreground/5 hover:text-primary'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {item.label}
                      {isActive && (
                        <span className="absolute left-3 right-3 bottom-0.5 h-0.5 bg-primary rounded-full" />
                      )}
                    </Link>
                  )
                })}
              </nav>
            )}

            <div className="flex items-center max-md:gap-2 sm:gap-1 ml-auto">
              <div className="relative flex items-center max-md:gap-2 sm:gap-1">
                <button
                  ref={contactsButtonRef}
                  onClick={(e) => {
                    setContactsKbd(e.detail === 0)
                    setContactsOpen(!contactsOpen)
                  }}
                  className="max-md:order-2 group w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-pill transition-colors duration-200 hover:bg-foreground/5 active:scale-95 focus-visible:outline-ring"
                  aria-label="Контакты"
                  aria-haspopup="dialog"
                  aria-expanded={contactsOpen}
                >
                  <IconPhone className="w-5 h-5 transition-transform duration-200 ease-out group-hover:scale-[1.08] motion-reduce:transform-none motion-reduce:transition-none" />
                </button>
                <ContactsPopover
                  isOpen={contactsOpen}
                  onClose={() => setContactsOpen(false)}
                  buttonRef={contactsButtonRef}
                  focusFirst={contactsKbd}
                />


                <button
                  onClick={onSearchOpen}
                  className="max-md:order-1 group w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-pill transition-colors duration-200 hover:bg-foreground/5 active:scale-95 focus-visible:outline-ring"
                  aria-label="Поиск"
                  aria-haspopup="dialog"
                >
                  <IconSearch className="w-5 h-5 transition-transform duration-200 ease-out group-hover:scale-[1.08] motion-reduce:transform-none motion-reduce:transition-none" />
                </button>

                {cartIcon && (
                  <div className="relative hidden md:block">
                    <button
                      onClick={openCart}
                      className="group w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-pill transition-colors duration-200 hover:bg-foreground/5 active:scale-95 focus-visible:outline-ring"
                      aria-label={count > 0 ? `Корзина, ${count} ${pluralize(count, ['товар', 'товара', 'товаров'])}` : 'Корзина'}
                    >
                      <span className="transition-transform duration-200 ease-out group-hover:scale-[1.08] motion-reduce:transform-none motion-reduce:transition-none">
                        {cartIcon}
                      </span>
                    </button>
                    {count > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold tabular-nums">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </div>
                )}

                {favoriteIcon && (
                  <div className="relative hidden md:block">
                    <button
                      onClick={openFavorites}
                      className="flex group w-11 h-11 sm:w-12 sm:h-12 items-center justify-center rounded-pill transition-colors duration-200 hover:bg-foreground/5 active:scale-95 focus-visible:outline-ring"
                      aria-label={favCount > 0 ? `Избранное, ${favCount} ${pluralize(favCount, ['товар', 'товара', 'товаров'])}` : 'Избранное'}
                    >
                      <span className="transition-transform duration-200 ease-out group-hover:scale-[1.08] motion-reduce:transform-none motion-reduce:transition-none">
                        {favoriteIcon}
                      </span>
                    </button>
                    {favCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold tabular-nums">
                        {favCount > 99 ? '99+' : favCount}
                      </span>
                    )}
                  </div>
                )}

                {isDesktop && (
                  <div className="hidden sm:flex items-center gap-1">
                    {isStaff(user) && (
                      <Link
                        to="/admin"
                        className="group hidden lg:flex w-11 h-11 sm:w-12 sm:h-12 items-center justify-center rounded-pill transition-colors duration-200 hover:bg-foreground/5 active:scale-95 focus-visible:outline-ring"
                        aria-label="Админка"
                        title="Админка"
                      >
                        <svg className="w-5 h-5 transition-transform duration-200 ease-out group-hover:scale-[1.08] motion-reduce:transform-none motion-reduce:transition-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.26 2.632 1.732-.44.9.023 2.04.9 2.532 1.6.776 1.6 3.414 0 4.19-.877.492-1.34 1.632-.9 2.532.678 1.472-.089 2.672-1.632 1.732-.996-.608-2.47-.15-3.15.807a1.724 1.724 0 01-2.573-1.066c-.426-1.756-2.924-1.756-3.35 0a1.724 1.724 0 01-2.573-1.066c-.44-.9-1.632-1.632-.9-2.532.877-.492 1.34-1.632.9-2.532-.678-1.472.089-2.672 1.632-1.732.996.608 2.47.15 3.15-.807a1.724 1.724 0 012.573 1.066z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </Link>
                    )}
                    <div className="flex items-center gap-1">
                      {isApprovedPro(user) && (
                        <span className="hidden lg:inline text-label font-semibold text-success whitespace-nowrap">
                          Специалист
                        </span>
                      )}
                      <Link
                        to={isAuthed ? '/orders' : '/auth'}
                        className="group w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-pill transition-colors duration-200 hover:bg-foreground/5 active:scale-95 focus-visible:outline-ring"
                        aria-label={isAuthed ? 'Мои заказы' : 'Вход'}
                      >
                        <IconUser className="w-5 h-5 transition-transform duration-200 ease-out group-hover:scale-[1.08] motion-reduce:transform-none motion-reduce:transition-none" />
                      </Link>
                    </div>
                  </div>
                )}

                {!isDesktop && (
                  <button
                    onClick={onMobileMenuOpen}
                    className="max-md:order-3 group w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-pill transition-colors duration-200 hover:bg-foreground/5 active:scale-95 focus-visible:outline-ring"
                    aria-label="Меню"
                  >
                    <IconMenu className="w-5 h-5 transition-transform duration-200 ease-out group-hover:scale-[1.08] motion-reduce:transform-none motion-reduce:transition-none" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

    </header>
  )
}
