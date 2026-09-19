import { useEffect, useRef, useState } from 'react'
import { EASE, animate, onScroll, prefersReducedMotion } from '../lib/motion'

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

/**
 * Считает число от нуля до value, когда блок появляется во вьюпорте.
 * Отсчёт идёт один раз. При prefers-reduced-motion сразу показывает конечное
 * значение — цифра всегда читаема.
 */
export default function CountUp({ value, suffix = '', duration = 1200, startDelay = 0, className = '' }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (prefersReducedMotion()) {
      setShown(value)
      return
    }

    setShown(0)
    const counter = { n: 0 }
    const animation = animate(counter, {
      n: value,
      duration,
      delay: startDelay,
      ease: EASE.out,
      onUpdate: () => setShown(Math.round(counter.n)),
      autoplay: onScroll({ target: el, enter: 'bottom-=12% top', repeat: false }),
    })

    return () => {
      animation.revert()
    }
  }, [value, duration, startDelay])

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {shown.toLocaleString('ru-RU')}
      {suffix}
    </span>
  )
}
