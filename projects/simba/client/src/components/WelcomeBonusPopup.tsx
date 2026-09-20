import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CloseIcon, GiftIcon } from './icons'
import CountUp from './CountUp'

const EXIT_MS = 200

type Props = {
  open: boolean
  amount: number
  onClose: () => void
}

/**
 * Приветственные бонусы после регистрации. Закрытие проигрывается до конца,
 * поэтому элемент живёт в DOM ещё EXIT_MS после того, как open стал false.
 */
export default function WelcomeBonusPopup({ open, amount, onClose }: Props) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  /** Уход не должен унести на экране полдороги отсчёта: закрытие проигрывается
      200мс, и всё это время «+188» читалось бы как настоящая сумма. */
  const [instant, setInstant] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const close = () => {
    setInstant(true)
    onClose()
  }

  useEffect(() => {
    if (open) {
      setInstant(false)
      returnFocusRef.current = document.activeElement as HTMLElement
      setMounted(true)
      // Кадр между монтированием и включением классов: без него браузер
      // применит конечное состояние сразу и перехода не будет видно.
      const raf = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(raf)
    }

    setShown(false)
    const timer = setTimeout(() => {
      setMounted(false)
      returnFocusRef.current?.focus()
    }, EXIT_MS)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!mounted) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setInstant(true)
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
      document.body.style.overflow = previousOverflow
    }
  }, [mounted, onClose])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        onClick={close}
        className={`absolute inset-0 bg-navy-900/40 transition-opacity ease-out ${
          shown ? 'opacity-100 duration-200' : 'opacity-0 duration-150'
        }`}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-bonus-title"
        tabIndex={-1}
        className={`relative w-full max-w-md bg-white border border-line rounded-card p-6 sm:p-8 text-center transition-[opacity,transform] ${
          shown
            ? 'opacity-100 translate-y-0 scale-100 duration-300'
            : 'opacity-0 translate-y-3 scale-[0.96] duration-200'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
      >
        <button
          onClick={close}
          aria-label="Закрыть"
          className="btn-press absolute top-2 right-2 w-11 h-11 flex items-center justify-center rounded-full text-navy-500 hover:bg-primary-tint transition-colors duration-100 ease"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
          <GiftIcon className="w-7 h-7 text-amber-600" />
        </div>

        {/* aria-hidden обязателен: диалог озвучивается в момент открытия, когда
            счётчик показывает «+0» — скринридер зачитал бы неверную сумму. */}
        <p className={instant ? '' : 'count-hero'} aria-hidden="true">
          <span className="text-[40px] leading-none font-black text-amber-600 tracking-tight">
            +{instant ? amount : <CountUp value={amount} duration={700} startDelay={80} />}
          </span>
        </p>
        <span className="sr-only">Начислено {amount} бонусов на счёт</span>

        <h2 id="welcome-bonus-title" className="mt-2 text-2xl font-bold text-navy-900">
          Бонусы уже на счёте
        </h2>

        <p className="mt-3 text-navy-500 leading-relaxed">
          Это приветственный подарок за регистрацию. 1 бонус = 1 ₽, потратить можно на любой
          заказ — до половины суммы чека.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            to="/catalog"
            onClick={close}
            className="btn-primary flex-1 sm:flex-[1.6] px-6"
          >
            Выбрать корм
          </Link>
          <button
            onClick={close}
            className="btn-outline flex-1 px-6 rounded-xl font-semibold"
          >
            Позже
          </button>
        </div>
      </div>
    </div>
  )
}
