import { useState, useEffect } from 'react'

/**
 * Хук отслеживает скроллинг страницы и возвращает true, если scrollY > threshold.
 * Используется для sticky-эффектов (blur шапки, схлопывание меню и т.п).
 */
export function useScrolled(threshold: number = 10): boolean {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Гистерезис: переходим в true при scrollY > threshold + 24,
      // возвращаемся в false при scrollY < threshold - 20
      setIsScrolled((prev) => {
        if (prev && window.scrollY < 4) return false
        if (!prev && window.scrollY > 24) return true
        return prev
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [threshold])

  return isScrolled
}
