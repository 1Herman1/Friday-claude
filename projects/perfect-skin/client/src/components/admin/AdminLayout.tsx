import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { IconMenu } from '@/components/icons'
import { useState } from 'react'

interface NavItem {
  label: string
  href: string
}

const navItems: NavItem[] = [
  { label: 'Дашборд', href: '/admin' },
  { label: 'Заказы', href: '/admin/orders' },
  { label: 'Товары', href: '/admin/products' },
  { label: 'Промокоды', href: '/admin/promo' },
  { label: 'Заявки специалистов', href: '/admin/pro-requests' },
  { label: 'Статьи', href: '/admin/posts' },
  { label: 'Обмен 1С', href: '/admin/sync' },
]

export function AdminLayout() {
  const { logout, user } = useAuth()
  const location = useLocation()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const isActive = (href: string): boolean => {
    if (href === '/admin') {
      return location.pathname === '/admin'
    }
    return location.pathname.startsWith(href)
  }

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      {/* Desktop Sidebar */}
      {isDesktop ? (
        <aside className="w-64 bg-dark text-dark-foreground border-r border-border sticky top-0 h-screen overflow-y-auto">
          <div className="p-6">
            <h1 className="text-lg font-heading font-bold text-accent-on-dark mb-8">
              Админка
            </h1>

            {/* Navigation */}
            <nav className="space-y-2 mb-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`block px-4 py-3 rounded-block font-sans text-sm transition-colors ${
                    isActive(item.href)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-dark-foreground hover:bg-dark/60'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* User Info */}
            <div className="border-t border-border pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                Вход как: <span className="font-semibold text-dark-foreground">{user?.name}</span>
              </p>
              <div className="space-y-2">
                <Link
                  to="/"
                  className="block px-4 py-2 rounded-block font-sans text-sm text-dark-foreground hover:bg-dark/60 transition-colors min-h-11 flex items-center"
                >
                  ← В магазин
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 rounded-block font-sans text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors min-h-11"
                >
                  Выход
                </button>
              </div>
            </div>
          </div>
        </aside>
      ) : (
        /* Mobile Top Bar */
        <div className="bg-dark text-dark-foreground border-b border-border sticky top-0 z-10">
          <div className="flex items-center justify-between p-4">
            <h1 className="text-lg font-heading font-bold text-accent-on-dark">
              Админка
            </h1>
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="w-10 h-10 flex items-center justify-center hover:bg-dark/60 rounded-pill transition-colors"
              aria-label="Меню"
            >
              <IconMenu />
            </button>
          </div>

          {/* Mobile Navigation Dropdown */}
          {mobileNavOpen && (
            <div className="border-t border-border bg-dark">
              <nav className="space-y-1 p-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={`block px-4 py-2 rounded-block font-sans text-sm transition-colors ${
                      isActive(item.href)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-dark-foreground hover:bg-dark/60'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="border-t border-border mt-4 pt-4 space-y-2">
                  <Link
                    to="/"
                    className="block px-4 py-2 rounded-block font-sans text-sm text-dark-foreground hover:bg-dark/60 transition-colors"
                  >
                    ← В магазин
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 rounded-block font-sans text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                  >
                    Выход
                  </button>
                </div>
              </nav>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
