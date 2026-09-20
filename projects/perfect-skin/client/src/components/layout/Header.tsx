import { IconMenu, IconUser, IconSearch } from '@/components/icons'
import { Link, useLocation } from 'react-router-dom'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useDrawer } from '@/context/DrawerContext'
import { useCart } from '@/context/CartContext'
import { useAuth, isApprovedPro, isStaff } from '@/context/AuthContext'
import { useFavorites } from '@/context/FavoritesContext'
import { pluralize } from '@/lib/format'

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
  { label: 'Контакты', href: '/contacts' },
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

  return (
    <header className="border-b border-border bg-background">
      <div className="container-app py-6 md:py-8">
        <div className="flex items-center justify-between gap-2">
          {/* Logo + Tagline */}
          <div className="shrink-0">
            <Link to="/" className="focus-visible:outline-ring block">
              <img
                src="/logo/logo-wordmark.webp"
                alt="Perfect Skin"
                width={120}
                height={20}
                className="h-5 md:h-6 w-auto"
              />
            </Link>
            <p className="hidden md:block text-xs font-sans text-muted-foreground text-center whitespace-nowrap">
              Назначают врачи. Любит ваша кожа
            </p>
          </div>

          {/* Desktop Navigation */}
          {isDesktop && (
            <nav className="flex items-center gap-5 xl:gap-8 text-body font-sans ml-6 xl:ml-10">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`whitespace-nowrap transition-colors duration-200 focus-visible:outline-ring ${
                      isActive
                        ? 'text-primary font-semibold'
                        : 'text-foreground hover:text-primary'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          )}

          {/* Right Actions */}
          <div className="flex items-center gap-4 ml-auto">
            {/* Phone */}
            {isDesktop && (
              <a
                href="tel:+74951832848"
                className="hidden 2xl:inline text-body-sm font-sans text-foreground hover:text-primary transition-colors duration-200 focus-visible:outline-ring whitespace-nowrap"
              >
                +7 (495) 183-28-48
              </a>
            )}

            {/* Icons */}
            <div className="flex items-center gap-1">
              {/* Search */}
              <button
                onClick={onSearchOpen}
                className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center hover:bg-muted rounded-pill transition-colors duration-200 focus-visible:outline-ring"
                aria-label="Поиск"
                aria-haspopup="dialog"
              >
                <IconSearch className="w-5 h-5" />
              </button>

              {cartIcon && (
                <div className="relative">
                  <button
                    onClick={openCart}
                    className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center hover:bg-muted rounded-pill transition-colors duration-200 focus-visible:outline-ring"
                    aria-label={count > 0 ? `Корзина, ${count} ${pluralize(count, ['товар', 'товара', 'товаров'])}` : 'Корзина'}
                  >
                    {cartIcon}
                  </button>
                  {count > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold tabular-nums ring-2 ring-background">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </div>
              )}
              {favoriteIcon && (
                <div className="relative">
                  <button
                    onClick={openFavorites}
                    className="hidden sm:flex w-12 h-12 items-center justify-center hover:bg-muted rounded-pill transition-colors duration-200 focus-visible:outline-ring"
                    aria-label={favCount > 0 ? `Избранное, ${favCount} ${pluralize(favCount, ['товар', 'товара', 'товаров'])}` : 'Избранное'}
                  >
                    {favoriteIcon}
                  </button>
                  {favCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold tabular-nums ring-2 ring-background">
                      {favCount > 99 ? '99+' : favCount}
                    </span>
                  )}
                </div>
              )}
              {/* Profile / Admin */}
              <div className="hidden sm:flex items-center gap-1">
                {isStaff(user) && (
                  <Link
                    to="/admin"
                    className="hidden lg:flex w-12 h-12 items-center justify-center hover:bg-muted rounded-pill transition-colors duration-200 focus-visible:outline-ring"
                    aria-label="Админка"
                    title="Админка"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="w-12 h-12 flex items-center justify-center hover:bg-muted rounded-pill transition-colors duration-200 focus-visible:outline-ring"
                    aria-label={isAuthed ? 'Мои заказы' : 'Вход'}
                  >
                    <IconUser className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Mobile Menu Button */}
            {!isDesktop && (
              <button
                onClick={onMobileMenuOpen}
                className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center focus-visible:outline-ring"
                aria-label="Меню"
                >
                  <IconMenu />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
