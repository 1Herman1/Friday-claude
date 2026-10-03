import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconPhone, IconMail } from '@/components/icons'

interface ContactsPopoverProps {
  isOpen: boolean
  onClose: () => void
  buttonRef: React.RefObject<HTMLButtonElement>
}

export function ContactsPopover({
  isOpen,
  onClose,
  buttonRef,
}: ContactsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const firstLinkRef = useRef<HTMLAnchorElement>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setIsAnimating(false)
      return
    }
    const id = requestAnimationFrame(() => {
      setIsAnimating(true)
      firstLinkRef.current?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        buttonRef.current?.focus()
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, buttonRef])

  if (!isOpen) return null

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Контакты"
      className={`fixed lg:absolute left-4 right-4 lg:left-auto lg:right-0 lg:w-[300px] top-[calc(var(--header-h)+8px)] lg:top-full lg:mt-3 bg-background border border-border rounded-block shadow-lg p-5 z-50 transition-opacity transition-transform duration-200 ${
        isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
      } motion-reduce:transition-none`}
    >
      <p className="text-label uppercase text-muted-foreground tracking-wide font-semibold mb-4">
        Связаться с нами
      </p>

      <div className="space-y-3">
        <a
          ref={firstLinkRef}
          href="tel:+74951832848"
          className="flex items-start gap-2 text-body-sm text-foreground hover:text-primary transition-colors focus-visible:outline-ring rounded py-1"
          onClick={onClose}
        >
          <IconPhone className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="font-semibold">+7 (495) 183-28-48</span>
            <span className="text-xs text-muted-foreground">Пн–Пт 10:00–21:00, Сб 11:00–17:00</span>
          </div>
        </a>

        <a
          href="mailto:mail@perfect-skin.shop"
          className="flex items-start gap-2 text-body-sm text-foreground hover:text-primary transition-colors focus-visible:outline-ring rounded py-1"
          onClick={onClose}
        >
          <IconMail className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
          <span className="font-semibold">mail@perfect-skin.shop</span>
        </a>

        <div className="flex items-start gap-2 text-body-sm text-foreground py-1">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground stroke-current fill-none stroke-[1.75]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>Москва, Звенигородское ш., 3Ас1</span>
        </div>

        <Link
          to="/contacts"
          className="inline-flex items-center gap-1 text-body-sm font-semibold text-primary hover:text-primary/80 transition-colors focus-visible:outline-ring rounded py-1"
          onClick={onClose}
        >
          Все контакты
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
