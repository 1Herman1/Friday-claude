const SELECTOR = '.btn-primary, .btn-outline, .btn-press'

/** Один слушатель на документ добавляет класс is-pressed при pointerdown на кнопку,
 *  снимает его при pointerup/pointercancel/lostpointercapture или при скрытии страницы.
 *  Возвращает функцию отписки. */
export function initButtonPress(): () => void {
  if (typeof window === 'undefined') return () => {}

  let pressedElement: HTMLElement | null = null

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary) return
    const button = (e.target as Element).closest<HTMLElement>(SELECTOR)
    if (!button) return
    if (button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true') return

    pressedElement = button
    button.classList.add('is-pressed')
  }

  const clearPress = () => {
    if (!pressedElement) return
    pressedElement.classList.remove('is-pressed')
    pressedElement = null
  }

  const onPointerUp = () => clearPress()
  const onPointerCancel = () => clearPress()
  const onLostPointerCapture = () => clearPress()
  const onVisibilityChange = () => clearPress()
  const onBlur = () => clearPress()

  const start = () => {
    document.addEventListener('pointerdown', onPointerDown, { passive: true, capture: true })
    document.addEventListener('pointerup', onPointerUp, { passive: true })
    document.addEventListener('pointercancel', onPointerCancel, { passive: true })
    document.addEventListener('lostpointercapture', onLostPointerCapture, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange, { passive: true })
    window.addEventListener('blur', onBlur, { passive: true })
  }

  const stop = () => {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('pointerup', onPointerUp)
    document.removeEventListener('pointercancel', onPointerCancel)
    document.removeEventListener('lostpointercapture', onLostPointerCapture)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('blur', onBlur)
    clearPress()
  }

  start()

  return stop
}
