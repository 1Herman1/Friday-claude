import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scroll-lock'
import { IconClose } from '../icons'

const EXIT_MS = 200

type Props = {
  open: boolean
  onClose: () => void
  title: string
  titleSuffix?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function SideDrawer({ open, onClose, title, titleSuffix, children, footer }: Props) {
  const titleId = useId()
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  // Mount/exit логика: когда открывается, смонтируем и покажем; когда закрывается,
  // скроем на EXIT_MS, потом размонтируем
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement
      setMounted(true)
      const raf = requestAnimationFrame(() => {
        setShown(true)
        closeBtnRef.current?.focus({ preventScroll: true })
      })
      return () => cancelAnimationFrame(raf)
    }

    setShown(false)
    const timer = setTimeout(() => {
      setMounted(false)
      returnFocusRef.current?.focus()
    }, EXIT_MS)
    return () => clearTimeout(timer)
  }, [open])

  // Фокус-трап и обработчик Escape
  useEffect(() => {
    if (!mounted) return

    lockBodyScroll()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable || focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
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

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`absolute inset-0 bg-foreground/35 transition-opacity
                    ${shown ? 'opacity-100 duration-300' : 'opacity-0 duration-200'}`}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-y-0 right-0 flex flex-col
                    w-full sm:w-[420px] max-w-full
                    bg-background shadow-lg sm:border-l sm:border-border
                    transition-[transform,opacity] ease-out
                    ${shown ? 'translate-x-0 opacity-100 duration-300' : 'translate-x-full opacity-0 duration-200'}`}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border
                        pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
          <h2 id={titleId} className="text-lg font-semibold text-foreground font-heading">
            {title}
            {titleSuffix && <span className="ml-2 text-base font-normal text-muted-foreground">{titleSuffix}</span>}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label={`Закрыть ${title.toLowerCase()}`}
            className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-pill text-muted-foreground hover:bg-muted transition-colors duration-200 ml-auto"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {/* Content (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex-shrink-0 border-t border-border bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
