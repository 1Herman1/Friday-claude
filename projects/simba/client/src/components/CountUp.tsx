import { useEffect, useRef, useState } from 'react'

type Props = {
  /** Конечное значение счётчика. */
  value: number
  /** Приписка после числа: «+», «%» и т.п. */
  suffix?: string
  /** Длительность отсчёта, мс. */
  duration?: number
  /** Пауза перед стартом, мс. Нужна там, где счётчик стартует не по скроллу,
      а внутри уже открывшейся сцены и должен дождаться её въезда. */
  startDelay?: number
  className?: string
}

/** Плавное замедление к концу — число «доезжает», а не тормозит рывком. */
function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Считает число от нуля до value, когда блок появляется во вьюпорте.
 * Отсчёт идёт один раз. При prefers-reduced-motion и без IntersectionObserver
 * сразу показывает конечное значение — цифра всегда читаема.
 */
export default function CountUp({ value, suffix = '', duration = 1200, startDelay = 0, className = '' }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)
  const startedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced || typeof IntersectionObserver === 'undefined') {
      setShown(value)
      return
    }

    setShown(0)
    let frame = 0

    const run = () => {
      const start = performance.now() + startDelay
      const tick = (now: number) => {
        // Math.max держит ноль на экране во время паузы: без него первый кадр
        // даёт отрицательный прогресс.
        const progress = Math.min(Math.max(now - start, 0) / duration, 1)
        setShown(Math.round(easeOut(progress) * value))
        if (progress < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !startedRef.current) {
            startedRef.current = true
            observer.unobserve(entry.target)
            run()
          }
        }
      },
      { threshold: 0, rootMargin: '0px 0px -12% 0px' }
    )

    observer.observe(el)
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [value, duration, startDelay])

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {shown.toLocaleString('ru-RU')}
      {suffix}
    </span>
  )
}
