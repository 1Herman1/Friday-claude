import { useId, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useDialog } from '@/hooks/useDialog'
import { BTN_PRIMARY, LINK_MORE } from '@/components/about/classes'
import { IconClose, IconPhone } from '@/components/icons'

type Props = {
  open: boolean
  onClose: () => void
  returnFocusTo: RefObject<HTMLElement>
}

export function ConsultationPopup({ open, onClose, returnFocusTo }: Props) {
  const titleId = useId()
  const callRef = useRef<HTMLAnchorElement>(null)
  const { mounted, shown, dialogRef } = useDialog(open, onClose, callRef, returnFocusTo)

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] md:grid md:place-items-center md:p-6">
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`absolute inset-0 bg-foreground/40 transition-opacity duration-200 ease-out motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-x-0 bottom-0 rounded-t-block bg-card px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lg
                    md:relative md:inset-auto md:w-full md:max-w-md md:rounded-block md:p-8
                    transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none
                    ${shown ? 'opacity-100 translate-y-0 md:scale-100' : 'pointer-events-none opacity-0 translate-y-2 md:translate-y-0 md:scale-[0.98]'}`}
      >
        <div className="flex items-start gap-4">
          <h2 id={titleId} className="pt-1 font-heading text-h3 font-bold [text-wrap:balance]">
            Консультация косметолога
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-2 -mt-1 ml-auto grid size-11 shrink-0 place-items-center rounded-pill text-muted-foreground transition-colors duration-200 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <IconClose size={20} />
          </button>
        </div>
        <p className="mt-3 text-body leading-body text-muted-foreground [text-wrap:pretty]">
          Опишите задачу&nbsp;— специалист подскажет уход и&nbsp;подберёт средства.
        </p>

        <a ref={callRef} href="tel:+74951832848" className={`${BTN_PRIMARY} mt-6 gap-3 sm:w-full`}>
          <IconPhone size={20} />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-body-sm font-semibold">Позвонить</span>
            <span className="text-price tabular-nums">+7 (495) 183-28-48</span>
          </span>
        </a>
        <p className="mt-3 text-center text-body-sm text-muted-foreground">Пн–Пт 10:00–21:00, Сб 11:00–17:00</p>

        <Link to="/consultation" onClick={onClose} className={`${LINK_MORE} mt-4 w-full justify-center`}>
          Оставить заявку&nbsp;— перезвоним сами
        </Link>
      </div>
    </div>,
    document.body,
  )
}
