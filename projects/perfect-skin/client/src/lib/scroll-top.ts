// Быстрый плавный подъём к началу страницы: длительность растёт с расстоянием, но не больше 700 мс.
// При «уменьшить движение» — мгновенно.
export function scrollToTopFast() {
  const start = window.scrollY
  if (start <= 0) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo(0, 0)
    return
  }
  const duration = Math.min(700, 250 + start / 12)
  const t0 = performance.now()
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / duration)
    window.scrollTo(0, Math.round(start * (1 - ease(k))))
    if (k < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
