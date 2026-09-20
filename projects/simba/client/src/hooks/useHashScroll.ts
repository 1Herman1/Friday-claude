import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Сколько ждём появления секции, прежде чем сдаться. */
const APPEAR_TIMEOUT_MS = 3000
/** Сколько после первой прокрутки доводим позицию, пока страница дособирается. */
const SETTLE_MS = 1200
/** Расхождение меньше этого не поправляем — иначе дёргаемся на округлениях. */
const TOLERANCE_PX = 4

/**
 * Прокрутка к якорю (`/#blog`) в одностраничном приложении.
 *
 * Браузер сам этого не делает: в момент перехода нужной секции ещё нет в DOM.
 * Поэтому ждём её появления, а затем ДОВОДИМ позицию: одной прокрутки мало —
 * пока грузятся картинки и раскрываются секции выше, цель уезжает. Замер на
 * главной показал промах в 420px, если остановиться на первой прокрутке.
 *
 * Уважает prefers-reduced-motion и scroll-margin-top секций (у них scroll-mt-24).
 */
export function useHashScroll() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) return

    const id = decodeURIComponent(hash.slice(1))
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth'

    let settleTimer: ReturnType<typeof setInterval> | undefined
    let appearTimer: ReturnType<typeof setTimeout> | undefined
    let observer: MutationObserver | undefined

    const scrollTo = (el: HTMLElement) => {
      el.scrollIntoView({ behavior })

      // Доводка. Целевое положение верха секции — её scroll-margin-top от верха
      // окна; пока страница дособирается, оно смещается.
      const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0
      const started = Date.now()
      settleTimer = setInterval(() => {
        if (Date.now() - started > SETTLE_MS) {
          clearInterval(settleTimer)
          return
        }
        const drift = el.getBoundingClientRect().top - margin
        if (Math.abs(drift) > TOLERANCE_PX) {
          window.scrollBy({ top: drift, behavior: 'auto' })
        }
      }, 100)
    }

    const existing = document.getElementById(id)
    if (existing) {
      scrollTo(existing)
    } else {
      observer = new MutationObserver(() => {
        const el = document.getElementById(id)
        if (!el) return
        observer?.disconnect()
        clearTimeout(appearTimer)
        scrollTo(el)
      })
      observer.observe(document.body, { childList: true, subtree: true })
      appearTimer = setTimeout(() => observer?.disconnect(), APPEAR_TIMEOUT_MS)
    }

    return () => {
      observer?.disconnect()
      clearTimeout(appearTimer)
      clearInterval(settleTimer)
    }
    // pathname в зависимостях: переход на тот же якорь с другой страницы обязан
    // сработать заново, хотя hash при этом не меняется.
  }, [pathname, hash])
}
