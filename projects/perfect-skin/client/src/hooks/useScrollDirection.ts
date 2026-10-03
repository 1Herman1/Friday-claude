import { useEffect, useRef, useState } from 'react'

interface ScrollState {
  hidden: boolean
  scrolled: boolean
}

export function useScrollDirection(
  headerHeight: number = 72,
  threshold: number = 6,
  disabled: boolean = false
): ScrollState {
  const [state, setState] = useState<ScrollState>({ hidden: false, scrolled: false })
  const lastScrollY = useRef(0)
  const rafId = useRef<number | null>(null)

  useEffect(() => {
    if (disabled) {
      setState({ hidden: false, scrolled: false })
      return
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setState({ hidden: false, scrolled: false })
      return
    }

    const handleScroll = () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
      }

      rafId.current = requestAnimationFrame(() => {
        const currentScrollY = window.scrollY

        let hidden = false
        if (currentScrollY > headerHeight) {
          hidden = currentScrollY > lastScrollY.current
        }

        const scrolled = currentScrollY > threshold

        setState({ hidden, scrolled })
        lastScrollY.current = currentScrollY
        rafId.current = null
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
      }
    }
  }, [headerHeight, threshold, disabled])

  return state
}
