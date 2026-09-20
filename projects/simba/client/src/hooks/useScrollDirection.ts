import { useEffect, useRef, useState } from 'react'

/**
 * Направление скролла для липких строк: вниз — прячем, вверх — показываем.
 *
 * Позиция и кадр хранятся в ref, а не в state: иначе каждый скролл
 * перерисовывал бы страницу и перевешивал слушатель. Наружу уходит только
 * булево «скрыто», и меняется оно редко.
 */
export function useScrollDirection(options?: { hideAfter?: number; threshold?: number }): { hidden: boolean } {
  const hideAfter = options?.hideAfter ?? 120
  const threshold = options?.threshold ?? 8
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    lastY.current = window.scrollY

    const onScroll = () => {
      if (raf.current !== null) return
      raf.current = requestAnimationFrame(() => {
        raf.current = null
        const y = window.scrollY
        const delta = y - lastY.current
        if (y < hideAfter) setHidden(false)
        else if (delta > threshold) setHidden(true)
        else if (delta < -threshold) setHidden(false)
        else return
        lastY.current = y
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf.current !== null) cancelAnimationFrame(raf.current)
    }
  }, [hideAfter, threshold])

  return { hidden }
}
