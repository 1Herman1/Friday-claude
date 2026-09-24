import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { useFavorites } from '../../context/FavoritesContext'
import { useDrawer } from '../../context/DrawerContext'
import { CONTACTS } from '../../lib/contacts'
import { HeartIcon, CartBagIcon, UserIcon, TelegramPlaneIcon, SearchIcon, PhoneIcon } from '../icons'
import SearchModal from './SearchModal'

interface MenuLink { label: string; href: string }
interface MenuItem { label: string; key: string | null; href: string; items?: MenuLink[] }

/** Решение владельца (16.09.2026): меню статичное, без дерева из админки. */
const MENU: MenuItem[] = [
  { label: 'Собаки', key: 'dogs', href: '/catalog?category=dogs', items: [
    { label: 'Сухой корм', href: '/catalog?category=dogs-dry' },
    { label: 'Влажный корм', href: '/catalog?category=dogs-wet' },
    { label: 'Лечебное питание', href: '/catalog?category=dogs-medical' },
    { label: 'Лакомства', href: '/catalog?category=treats' } ]},
  { label: 'Коты и кошки', key: 'cats', href: '/catalog?category=cats', items: [
    { label: 'Сухой корм', href: '/catalog?category=cats-dry' },
    { label: 'Влажный корм', href: '/catalog?category=cats-wet' },
    { label: 'Лечебное питание', href: '/catalog?category=cats-medical' },
    { label: 'Лакомства', href: '/catalog?category=treats' } ]},
  { label: 'Ветаптека', key: null, href: '/catalog?category=care' },
]

export default function Header() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [contactsOpen, setContactsOpen] = useState(false)
  const contactsRef = useRef<HTMLDivElement>(null)

  // Попап контактов закрывается тапом вне и по Esc.
  useEffect(() => {
    if (!contactsOpen) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (contactsRef.current?.contains(t)) return
      if ((t as Element).closest?.('[aria-label="Контакты"]')) return
      setContactsOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setContactsOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [contactsOpen])
  const { count: cartCount } = useCart()
  const { count: favCount } = useFavorites()
  const { openCart, openFavorites, drawer } = useDrawer()

  return (
    <header className="fixed top-[10px] left-0 right-0 z-50">
      {/* Десктоп шапка — пилюля */}
      <div className="hidden md:block px-4" onMouseLeave={() => setActiveCategory(null)}>
        {/* Пилюля */}
        <div className="relative max-w-7xl mx-auto rounded-full px-8 h-16 flex items-center justify-between bg-[rgb(119_119_119_/_0.5)] supports-[backdrop-filter]:backdrop-blur-[8px] shadow-md drop-shadow-sm">
          {/* Слева — навигация */}
          <nav className="flex items-center gap-4 lg:gap-6">
            {MENU.map((cat) => (
              <div
                key={cat.label}
                onMouseEnter={() => cat.key ? setActiveCategory(cat.key) : setActiveCategory(null)}
                onFocus={() => cat.key ? setActiveCategory(cat.key) : setActiveCategory(null)}
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActiveCategory(null) }}
                onKeyDown={(e) => { if (e.key === 'Escape') setActiveCategory(null) }}
                className="relative"
              >
                <Link
                  to={cat.href}
                  className="inline-flex items-center h-11 text-white font-medium text-sm transition-opacity duration-100 hover:opacity-75 header-pill-text"
                >
                  {cat.label}
                </Link>
                {cat.key && activeCategory === cat.key && cat.items && (
                  <div className="absolute left-0 top-full mt-3 w-max max-w-sm bg-white rounded-card shadow-md overflow-hidden animate-slide-down z-50">
                    <div className="px-4 py-3 grid grid-cols-2 gap-x-2 gap-y-1">
                      {cat.items.map((item) => (
                        <Link
                          key={item.label}
                          to={item.href}
                          className="block px-3 py-2 rounded-lg text-navy-700 text-sm font-medium hover:bg-blue-50 hover:text-navy-900 transition-colors duration-100"
                          onClick={() => setActiveCategory(null)}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* По центру — логотип */}
          {/* PNG обрезан по «чернилам» (было 1968×520 с пустыми полями справа и снизу),
              поэтому логотип центруется без сдвигов на любой ширине. Видимый размер тот,
              что владелец выставил в тюнере: 240px старого файла = 154px обрезанного. */}
          <Link to="/" data-layout-transform className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center flex-shrink-0 header-logo">
            <img src="/logo-header.png" alt="Симба" className="w-[62px] lg:w-[154px] h-auto header-pill-logo" />
          </Link>

          {/* Справа — иконки */}
          <div className="flex items-center gap-1 lg:gap-3 ml-auto">
            {/* Telegram — та же 44px-обёртка, что у соседей; залитый самолётик, как в логотипе Telegram */}
            <a
              href={CONTACTS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Написать в Telegram"
              className="btn-press header-pill-icon w-11 h-11 inline-flex items-center justify-center rounded-xl text-white"
            >
              <TelegramPlaneIcon className="header-ico-telegram w-[21px] h-[18px]" />
            </a>

            {/* Поиск */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Поиск"
              className="btn-press header-pill-icon w-11 h-11 inline-flex items-center justify-center rounded-xl text-white"
            >
              <SearchIcon className="header-ico-search w-[22px] h-[22px]" />
            </button>

            {/* Профиль */}
            <Link to="/profile" aria-label="Профиль" className="btn-press header-pill-icon w-11 h-11 inline-flex items-center justify-center rounded-xl text-white">
              <UserIcon className="header-ico-profile w-[22px] h-[22px]" />
            </Link>

            {/* Избранное */}
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false)
                openFavorites()
              }}
              aria-label="Избранное"
              aria-haspopup="dialog"
              aria-expanded={drawer === 'favorites'}
              className="btn-press header-pill-icon relative w-11 h-11 inline-flex items-center justify-center rounded-xl text-white"
            >
              <HeartIcon className="header-ico-heart w-[22px] h-[22px]" />
              {favCount > 0 && (
                <span key={`fav-${favCount}`} className="absolute -top-0.5 -right-0.5 bg-amber-400 text-navy-900 text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold px-1 animate-badge-pop">
                  {favCount}
                </span>
              )}
            </button>

            {/* Корзина */}
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false)
                openCart()
              }}
              aria-label="Корзина"
              aria-haspopup="dialog"
              aria-expanded={drawer === 'cart'}
              className="btn-press header-pill-icon relative w-11 h-11 inline-flex items-center justify-center rounded-xl text-white"
            >
              <CartBagIcon className="header-ico-cart w-5 h-5" />
              {cartCount > 0 && (
                <span key={`cart-${cartCount}`} className="absolute -top-0.5 -right-0.5 bg-amber-400 text-navy-900 text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold px-1 animate-badge-pop">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Мобильная шапка */}
      <div className="md:hidden px-4 pt-2">
        {/* Пилюля мобильная */}
        <div className="relative flex items-center justify-between h-14 bg-[rgb(119_119_119_/_0.5)] supports-[backdrop-filter]:backdrop-blur-[8px] rounded-full px-4 drop-shadow-sm">
          {/* Бургер */}
          <button
            onClick={() => {
              setContactsOpen(false)
              setMobileMenuOpen(!mobileMenuOpen)
            }}
            className="btn-press text-white w-11 h-11 flex items-center justify-center -ml-2 header-pill-text"
            aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={mobileMenuOpen}
            type="button"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                 className={`ico-burger ${mobileMenuOpen ? 'is-open' : ''}`} aria-hidden="true">
              <g className="ico-burger__lines">
                <path d="M3 5h18M3 12h18M3 19h18" />
              </g>
              <g className="ico-burger__close">
                <path d="M6.758 17.243L12.001 12m5.243-5.243L12 12m0 0L6.758 6.757M12.001 12l5.243 5.243" />
              </g>
            </svg>
          </button>

          {/* Логотип по центру */}
          <Link to="/" data-layout-transform className="flex items-center flex-shrink-0 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <img src="/logo-header.png" alt="Симба" className="w-[96px] h-auto header-pill-logo" />
          </Link>

          {/* Справа — Telegram и контакты, в стиле пилюли (корзина живёт в нижнем меню) */}
          <div className="flex items-center -mr-2">
            <a
              href={CONTACTS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Написать в Telegram"
              className="btn-press header-pill-icon text-white w-11 h-11 flex items-center justify-center rounded-xl"
            >
              <TelegramPlaneIcon className="w-[21px] h-[18px]" />
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false)
                setContactsOpen((v) => !v)
              }}
              aria-label="Контакты"
              aria-haspopup="dialog"
              aria-expanded={contactsOpen}
              className={`btn-press header-pill-icon text-white w-11 h-11 flex items-center justify-center rounded-xl ${contactsOpen ? 'bg-white/28' : ''}`}
            >
              <PhoneIcon className="w-[22px] h-[22px]" />
            </button>
          </div>
        </div>

        {/* Попап контактов — под пилюлей */}
        {contactsOpen && (
          <div ref={contactsRef} role="dialog" aria-label="Контакты" className="mt-2 bg-white rounded-card shadow-md overflow-hidden animate-slide-down">
            <div className="px-5 py-4 flex flex-col gap-2">
              <a href={CONTACTS.phoneHref} className="text-2xl font-semibold text-navy-900 tracking-tight">
                {CONTACTS.phone}
              </a>
              <p className="text-sm text-navy-500">{CONTACTS.hours}</p>
              <p className="text-sm text-navy-700">Поможем подобрать корм и оформить заказ.</p>
              <a
                href={CONTACTS.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary press-wide w-full mt-2"
                onClick={() => setContactsOpen(false)}
              >
                Написать в Telegram
              </a>
            </div>
          </div>
        )}

        {/* Мобильное меню — только корни */}
        {mobileMenuOpen && (
          <div className="mt-2 bg-white rounded-card shadow-md overflow-hidden animate-slide-down">
            <nav className="px-4 py-3 flex flex-col gap-1">
              {MENU.map((cat) => (
                <Link
                  key={cat.label}
                  to={cat.href}
                  className="py-3 px-3 rounded-lg font-medium text-navy-900 hover:bg-blue-50 transition-colors duration-100 block"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {cat.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>

      {/* Модалка поиска */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
