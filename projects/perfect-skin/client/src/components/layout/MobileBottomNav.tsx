import { Link, useLocation } from 'react-router-dom'
import { IconCart, IconHeart, IconUser } from '@/components/icons'
import { useDrawer } from '@/context/DrawerContext'
import { useCart } from '@/context/CartContext'
import { useFavorites } from '@/context/FavoritesContext'
import { useAuth } from '@/context/AuthContext'
import { useScenePinned } from '@/lib/scene-pin'
import { scrollToTopFast } from '@/lib/scroll-top'

// Нижняя панель телефона (как в Симбе): Главная, Избранное, Корзина, Профиль.
// iOS — плавающая скруглённая «пилюля», Android — прямоугольная полоса у нижнего края.
export function MobileBottomNav() {
  const location = useLocation()
  const { drawer, openCart, openFavorites, close } = useDrawer()
  const { count } = useCart()
  const { count: favCount } = useFavorites()
  const { isAuthed } = useAuth()
  const pinned = useScenePinned()

  const item =
    'relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full rounded-full text-[11px] font-sans font-medium transition-colors duration-200 active:scale-95'
  const state = (active: boolean) => (active ? 'text-primary font-semibold' : 'text-foreground/70')
  const onHome = location.pathname === '/'
  const profileHref = isAuthed ? '/orders' : '/auth'
  const onProfile = location.pathname === profileHref

  const badge = (n: number) =>
    n > 0 && (
      <span className="absolute top-1 left-1/2 ml-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold tabular-nums">
        {n > 99 ? '99+' : n}
      </span>
    )

  return (
    <nav
      aria-label="Основная навигация"
      className={`md:hidden fixed z-30 transition-transform duration-300 ease-out
        inset-x-0 bottom-0 h-[calc(64px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-background/90 backdrop-blur-xl backdrop-saturate-150 border-t border-border
        ios:inset-x-4 ios:bottom-[calc(env(safe-area-inset-bottom)+8px)] ios:h-16 ios:pb-0 ios:rounded-full ios:border-0 ios:bg-background/80 ios:shadow-[0_6px_24px_rgba(20,32,46,0.14)] ios:ring-1 ios:ring-foreground/5
        ${pinned ? 'translate-y-[calc(100%+24px)]' : 'translate-y-0'}`}
    >
      <div className="flex h-full items-stretch px-2">
        <Link
          to="/"
          className={`${item} ${state(onHome && !drawer)}`}
          aria-current={onHome ? 'page' : undefined}
          onClick={(e) => {
            close()
            if (onHome) {
              e.preventDefault()
              scrollToTopFast()
            }
          }}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
          </svg>
          Главная
        </Link>
        <button
          type="button"
          className={`${item} ${state(drawer === 'favorites')}`}
          onClick={() => (drawer === 'favorites' ? close() : openFavorites())}
          aria-label={favCount > 0 ? `Избранное, ${favCount}` : 'Избранное'}
        >
          <IconHeart className="w-6 h-6" />
          Избранное
          {badge(favCount)}
        </button>
        <button
          type="button"
          className={`${item} ${state(drawer === 'cart')}`}
          onClick={() => (drawer === 'cart' ? close() : openCart())}
          aria-label={count > 0 ? `Корзина, ${count}` : 'Корзина'}
        >
          <IconCart className="w-6 h-6" />
          Корзина
          {badge(count)}
        </button>
        <Link
          to={profileHref}
          className={`${item} ${state(onProfile && !drawer)}`}
          aria-current={onProfile ? 'page' : undefined}
          onClick={() => close()}
        >
          <IconUser className="w-6 h-6" />
          Профиль
        </Link>
      </div>
    </nav>
  )
}
