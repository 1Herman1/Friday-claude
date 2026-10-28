import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDialog } from '@/hooks/useDialog'
import { IconClose } from '../icons'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  titleSuffix?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  closeLabel?: string
}

export default function SideDrawer({ open, onClose, title, titleSuffix, children, footer, closeLabel }: Props) {
  const titleId = useId()
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const { mounted, shown, dialogRef } = useDialog(open, onClose, closeBtnRef)

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
                    transition-[transform,opacity] ease-out motion-reduce:translate-x-0 motion-reduce:transition-opacity
                    ${shown ? 'translate-x-0 opacity-100 duration-300' : 'translate-x-full opacity-0 duration-200 pointer-events-none'}`}
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
            aria-label={closeLabel ?? `Закрыть ${title.toLowerCase()}`}
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
