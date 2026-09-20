import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/scroll-lock'
import { CloseIcon } from '../icons'
import QuizFlow from './QuizFlow'

const EXIT_MS = 150

interface Props {
  open: boolean
  onClose: () => void
}

export default function QuizModal({ open, onClose }: Props) {
  const titleId = useId()
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  // Mount/exit логика как в SearchModal
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement
      setMounted(true)
      // rAF перед включением классов
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
    <div className="fixed inset-0 z-[80] flex items-start justify-center sm:px-4 sm:pt-[6vh]">
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`absolute inset-0 bg-navy-900/40 supports-[backdrop-filter]:backdrop-blur-sm
                    transition-opacity ease-smooth
                    ${shown ? 'opacity-100 duration-200' : 'opacity-0 duration-150'}`}
      />

      {/* Диалог */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex flex-col w-full bg-white shadow-xl overflow-hidden
                    h-[100dvh] rounded-none
                    sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-[28px] sm:border sm:border-line
                    transition-[opacity,transform] ease-smooth
                    ${shown
                      ? 'opacity-100 sm:scale-100 duration-200 sm:duration-[240ms]'
                      : 'opacity-0 sm:scale-[0.96] duration-150 sm:duration-150'}`}
      >
        <h2 id={titleId} className="sr-only">Подбор корма для питомца</h2>

        {/* Кнопка закрытия. z-50: липкая шапка прогресса внутри квиза идёт с z-40
            и иначе накрывает крестик — он становится невидимым и некликабельным. */}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Закрыть подбор корма"
          className="btn-press absolute top-3 right-3 sm:top-4 sm:right-4 w-11 h-11 z-50 flex items-center justify-center rounded-full bg-white/90 text-navy-500 hover:bg-primary-tint"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        {/* Контент (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* Закрытие при переходе на товар из результатов делает Layout —
              он закрывает оверлей на смену маршрута, отдельный onClose не нужен. */}
          <QuizFlow startPhase="quiz" inModal />
        </div>
      </div>
    </div>,
    document.body
  )
}
