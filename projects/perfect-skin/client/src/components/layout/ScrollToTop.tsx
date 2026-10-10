import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// При смене страницы — к её началу (браузер в одностраничном приложении этого сам не делает)
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
