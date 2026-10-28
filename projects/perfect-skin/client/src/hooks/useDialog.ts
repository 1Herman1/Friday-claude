import { useEffect, useRef, useState, type RefObject } from 'react'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scroll-lock'

const EXIT_MS = 200
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useDialog(
  open: boolean,
  onClose: () => void,
  initialFocusRef: RefObject<HTMLElement>,
  returnFocusTo?: RefObject<HTMLElement>,
) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      // Safari не фокусирует кнопку по клику — поэтому явная цель возврата важнее activeElement
      returnFocusRef.current = returnFocusTo?.current ?? (document.activeElement as HTMLElement)
      setMounted(true)
      const raf = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(raf)
    }

    setShown(false)
    const timer = setTimeout(() => {
      setMounted(false)
      returnFocusRef.current?.focus()
    }, EXIT_MS)
    return () => clearTimeout(timer)
  }, [open, returnFocusTo])

  // Фокус — после монтирования: в rAF элемента ещё нет в DOM
  useEffect(() => {
    if (mounted && open) initialFocusRef.current?.focus({ preventScroll: true })
  }, [mounted, open, initialFocusRef])

  useEffect(() => {
    if (!mounted) return

    lockBodyScroll()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!focusable || focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      unlockBodyScroll()
    }
  }, [mounted, onClose])

  return { mounted, shown, dialogRef }
}
