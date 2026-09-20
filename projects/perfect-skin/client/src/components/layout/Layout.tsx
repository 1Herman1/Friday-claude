import { ReactNode, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { TopBar } from './TopBar'
import { Header } from './Header'
import { MobileMenu } from './MobileMenu'
import { Footer } from './Footer'
import { SearchModal } from './SearchModal'
import CartDrawer from '@/components/cart/CartDrawer'
import FavoritesDrawer from '@/components/favorites/FavoritesDrawer'
import { QuizModal } from '@/components/quiz/QuizModal'
import { useDrawer } from '@/context/DrawerContext'

interface LayoutProps {
  children: ReactNode
  cartIcon?: ReactNode
  favoriteIcon?: ReactNode
}

export function Layout({
  children,
  cartIcon,
  favoriteIcon,
}: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { drawer, close } = useDrawer()
  const location = useLocation()

  // Закрываем шторку при смене маршрута
  useEffect(() => {
    close()
  }, [location.pathname, close])

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar />
      <Header
        cartIcon={cartIcon}
        favoriteIcon={favoriteIcon}
        onMobileMenuOpen={() => setMobileMenuOpen(true)}
        onSearchOpen={() => setSearchOpen(true)}
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1">
        {children}
      </main>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer open={drawer === 'cart'} onClose={close} />
      <FavoritesDrawer open={drawer === 'favorites'} onClose={close} />
      <QuizModal open={drawer === 'quiz'} onClose={close} />

      <Footer />
    </div>
  )
}
