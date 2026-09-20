import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * При смене маршрута прокручивает страницу к началу.
 * Плавно — если пользователь не просил «уменьшить движение», иначе мгновенно.
 * Якорные переходы (#hash) пропускает — за ними отвечает useHashScroll.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }, [pathname, hash])

  return null
}
