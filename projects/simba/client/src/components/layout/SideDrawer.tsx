import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/scroll-lock'
import { CloseIcon } from '../icons'

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
  // Корзина и избранное — два экземпляра SideDrawer, смонтированные одновременно
  // (Layout.tsx рендерит оба всегда). При переключении между ними на 200мс
  // (EXIT_MS) окне закрывающийся drawer ещё не размонтирован, а новый уже
  // открылся — id должен быть уникален на инстанс, иначе два DOM-элемента
  // с одинаковым id="drawer-title" одновременно, aria-labelledby ломается.
  const titleId = useId()
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  // Mount/exit логика как в SearchModal
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement
      setMounted(true)
      // rAF перед включением классов
      const raf = requestAnimationFrame(() => {
        setShown(true)
        // Фокус на контейнер, а не на кнопку закрытия: иначе глобальный *:focus-visible рисовал кольцо на круглой кнопке при каждом открытии мышью. Клавиатурный Tab по-прежнему подсвечивает кнопку.
        dialogRef.current?.focus({ preventScroll: true })
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
      const onDialog = document.activeElement === dialogRef.current
      if (event.shiftKey && (onDialog || document.activeElement === first)) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && (onDialog || document.activeElement === last)) {
        event.preventDefault(); first.focus()
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
        className={`absolute inset-0 bg-navy-900/40 supports-[backdrop-filter]:backdrop-blur-sm
                    transition-opacity ease-smooth
                    ${shown ? 'opacity-100 duration-300' : 'opacity-0 duration-200'}`}
      />

      {/* Диалог */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`absolute top-0 bottom-[calc(64px+env(safe-area-inset-bottom))] sm:bottom-0 right-0 flex flex-col
                    w-full sm:w-[420px] max-w-full
                    bg-white shadow-xl sm:border-l sm:border-line sm:rounded-l-card sm:overflow-hidden
                    rounded-b-card sm:rounded-b-none
                    outline-none
                    transition-[transform,opacity] ease-drawer
                    ${shown ? 'translate-x-0 opacity-100 duration-300' : 'translate-x-full opacity-0 duration-200'}`}
      >
        {/* Шапка */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-line
                        pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
          <h2 id={titleId} className="text-lg font-bold text-navy-900">
            {title}
            {titleSuffix && <span className="ml-2 text-base font-normal text-navy-400">{titleSuffix}</span>}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Закрыть ${title === 'Корзина' ? 'корзину' : 'избранное'}`}
            className="btn-press w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full text-navy-500 hover:bg-black/5 ml-auto"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Контент (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>

        {/* Футер */}
        {footer && (
          <div className="flex-shrink-0 border-t border-line bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
