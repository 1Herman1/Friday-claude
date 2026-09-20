import { IconMenu, IconUser, IconSearch } from '@/components/icons'
import { Link } from 'react-router-dom'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useDrawer } from '@/context/DrawerContext'
import { useCart } from '@/context/CartContext'
import { useAuth } from '@/context/AuthContext'
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
  { label: 'О компании', href: '/about' },
  { label: 'Контакты', href: '/contacts' },
]

export function Header({
  cartIcon,
  favoriteIcon,
  onMobileMenuOpen,
  onSearchOpen,
}: HeaderProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const { openCart, openFavorites } = useDrawer()
  const { count } = useCart()
  const { count: favCount } = useFavorites()
  const { isAuthed } = useAuth()

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
            <nav className="flex items-center gap-2 text-body font-sans">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="text-foreground hover:text-primary transition-colors duration-200 focus-visible:outline-ring"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          {/* Right Actions */}
          <div className="flex items-center gap-1 ml-auto">
            {/* Phone */}
            {isDesktop && (
              <a
                href="tel:+74951832848"
                className="text-body-sm font-sans text-foreground hover:text-primary transition-colors duration-200 focus-visible:outline-ring whitespace-nowrap"
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
              <Link
                to={isAuthed ? '/orders' : '/auth'}
                className="hidden sm:flex w-12 h-12 items-center justify-center hover:bg-muted rounded-pill transition-colors duration-200 focus-visible:outline-ring"
                aria-label={isAuthed ? 'Мои заказы' : 'Вход'}
              >
                <IconUser className="w-5 h-5" />
              </Link>
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
