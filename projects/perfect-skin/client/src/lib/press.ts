// Нажатие на тач-экране: класс is-pressed на плитке, пока палец на ней. На iOS :active
// без обработчика touchstart не срабатывает, а при начале прокрутки браузер шлёт
// pointercancel — нажатие снимается, плитка не «залипает».
const SELECTOR = '.press-tile'

export function initPress(): () => void {
  if (typeof window === 'undefined') return () => {}
  let pressed: HTMLElement | null = null
  const clear = () => {
    pressed?.classList.remove('is-pressed')
    pressed = null
  }
  const down = (e: PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary) return
    const el = (e.target as Element).closest<HTMLElement>(SELECTOR)
    if (!el) return
    pressed = el
    el.classList.add('is-pressed')
  }
  document.addEventListener('pointerdown', down, { passive: true, capture: true })
  document.addEventListener('pointerup', clear, { passive: true })
  document.addEventListener('pointercancel', clear, { passive: true })
  document.addEventListener('visibilitychange', clear)
  window.addEventListener('blur', clear)
  return () => {
    document.removeEventListener('pointerdown', down, { capture: true })
    document.removeEventListener('pointerup', clear)
    document.removeEventListener('pointercancel', clear)
    document.removeEventListener('visibilitychange', clear)
    window.removeEventListener('blur', clear)
    clear()
  }
}
