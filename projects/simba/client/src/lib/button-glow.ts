type Pending = { x: number; y: number; target: HTMLElement | null }

const SELECTOR = '.btn-primary, .btn-outline, .btn-glow'

/** Один слушатель на документ пишет --mx/--my ближайшей кнопке с классом .btn-primary/.btn-outline/.btn-glow под курсором.
 *  Возвращает функцию отписки. */
export function initButtonGlow(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')

  let frame = 0
  let pending: Pending | null = null
  let active: HTMLElement | null = null
  let listening = false

  let clearTimer = 0

  // Координаты снимаем ПОСЛЕ затухания (выход opacity = 105мс): иначе
  // пятно телепортируется в центр кнопки прямо посреди угасания.
  const clear = () => {
    if (!active) return
    const el = active
    active = null
    window.clearTimeout(clearTimer)
    clearTimer = window.setTimeout(() => {
      el.style.removeProperty('--mx')
      el.style.removeProperty('--my')
    }, 200)
  }

  const paint = () => {
    frame = 0
    const p = pending
    pending = null
    if (!p) return
    if (p.target !== active) clear()
    if (!p.target) return
    window.clearTimeout(clearTimer)
    const r = p.target.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return
    active = p.target
    active.style.setProperty('--mx', `${(((p.x - r.left) / r.width) * 100).toFixed(2)}%`)
    active.style.setProperty('--my', `${(((p.y - r.top) / r.height) * 100).toFixed(2)}%`)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const el = e.target instanceof Element ? e.target.closest<HTMLElement>(SELECTOR) : null
    if (!el && !active) return
    pending = { x: e.clientX, y: e.clientY, target: el }
    if (frame === 0) frame = requestAnimationFrame(paint)
  }

  const onPointerLeave = () => {
    pending = null
    clear()
  }

  const start = () => {
    if (listening) return
    listening = true
    document.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerleave', onPointerLeave, { passive: true })
  }

  const stop = () => {
    if (!listening) return
    listening = false
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerleave', onPointerLeave)
    if (frame !== 0) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    pending = null
    clear()
  }

  const sync = () => {
    if (finePointer.matches && !reduced.matches) start()
    else stop()
  }

  reduced.addEventListener('change', sync)
  finePointer.addEventListener('change', sync)
  sync()

  return () => {
    reduced.removeEventListener('change', sync)
    finePointer.removeEventListener('change', sync)
    stop()
  }
}
