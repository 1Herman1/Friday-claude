import { NavLink } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { useFavorites } from '../../context/FavoritesContext'
import { useDrawer } from '../../context/DrawerContext'
import { HomeIcon, HeartIcon, CartIcon, UserIcon } from '../icons'

export default function MobileBottomNav() {
  const { count: cartCount } = useCart()
  const { count: favCount } = useFavorites()
  const { openCart, openFavorites, drawer, close } = useDrawer()

  const handleCartClick = () => {
    if (drawer === 'cart') {
      close()
    } else {
      openCart()
    }
  }

  const handleFavoritesClick = () => {
    if (drawer === 'favorites') {
      close()
    } else {
      openFavorites()
    }
  }

  return (
    <nav
      className={`bottom-nav-rim md:hidden fixed left-4 right-4 bottom-[10px] z-[70] isolate rounded-full h-14 bg-[rgb(119_119_119_/_0.5)] supports-[backdrop-filter]:backdrop-blur-[8px] drop-shadow-sm ${drawer ? 'is-paused' : ''}`}
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-full items-center justify-around px-2">
        {/* Главная */}
        <NavLink
          to="/"
          aria-label="Главная"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 w-16 h-12 rounded-full text-white header-pill-text transition-colors duration-100 ease ${
              isActive ? 'bg-white/28' : ''
            }`
          }
        >
          <HomeIcon className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-medium leading-none">Главная</span>
        </NavLink>

        {/* Избранное */}
        <button
          type="button"
          onClick={handleFavoritesClick}
          aria-label={drawer === 'favorites' ? 'Закрыть избранное' : 'Открыть избранное'}
          className={`flex flex-col items-center justify-center gap-0.5 w-16 h-12 rounded-full text-white header-pill-text transition-colors duration-100 ease ${
            drawer === 'favorites' ? 'bg-white/28' : ''
          }`}
        >
          <div className="relative">
            <HeartIcon className="w-[22px] h-[22px]" />
            {favCount > 0 && (
              <span key={`fav-nav-${favCount}`} className="absolute -top-1 -right-1 bg-amber-400 text-navy-900 text-[10px] min-w-[16px] h-4 rounded-full flex items-center justify-center font-bold px-0.5 animate-badge-pop">
                {favCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium leading-none">Избранное</span>
        </button>

        {/* Корзина */}
        <button
          type="button"
          onClick={handleCartClick}
          aria-label={drawer === 'cart' ? 'Закрыть корзину' : 'Открыть корзину'}
          className={`flex flex-col items-center justify-center gap-0.5 w-16 h-12 rounded-full text-white header-pill-text transition-colors duration-100 ease ${
            drawer === 'cart' ? 'bg-white/28' : ''
          }`}
        >
          <div className="relative">
            <CartIcon className="w-[22px] h-[22px]" />
            {cartCount > 0 && (
              <span key={`cart-nav-${cartCount}`} className="absolute -top-1 -right-1 bg-amber-400 text-navy-900 text-[10px] min-w-[16px] h-4 rounded-full flex items-center justify-center font-bold px-0.5 animate-badge-pop">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium leading-none">Корзина</span>
        </button>

        {/* Профиль */}
        <NavLink
          to="/profile"
          aria-label="Профиль"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 w-16 h-12 rounded-full text-white header-pill-text transition-colors duration-100 ease ${
              isActive ? 'bg-white/28' : ''
            }`
          }
        >
          <UserIcon className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-medium leading-none">Профиль</span>
        </NavLink>
      </div>
    </nav>
  )
}
