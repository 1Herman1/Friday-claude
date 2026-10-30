import { useEffect, useRef, useState } from 'react'
import { fetchBonusCheckout, type BonusCheckoutQuote } from '@/lib/bonus-api'
import { bonusWord, isBonusDemo } from '@/lib/bonus-labels'
import { formatPrice } from '@/lib/format'

const QUOTE_DELAY_MS = 300
const HIDDEN_REASONS = new Set(['PROGRAM_DISABLED', 'AUTH_REQUIRED', 'NOT_ELIGIBLE', 'NOT_MEMBER'])
const MAX_DIGITS = 7

interface BonusSpendSectionProps {
  promoCode: string | null
  value: number
  onChange: (points: number) => void
  onQuote: (quote: BonusCheckoutQuote | null) => void
}

export function BonusSpendSection({ promoCode, value, onChange, onQuote }: BonusSpendSectionProps) {
  const [quote, setQuote] = useState<BonusCheckoutQuote | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const callbacks = useRef({ onChange, onQuote })

  useEffect(() => {
    callbacks.current = { onChange, onQuote }
  })

  useEffect(() => {
    if (isBonusDemo()) return
    let ignore = false
    const timer = window.setTimeout(() => {
      fetchBonusCheckout(promoCode ?? undefined, value)
        .then((next) => {
          if (ignore) return
          setLoadFailed(false)
          setQuote(next)
          callbacks.current.onQuote(next)
          if (next.reason === 'PROMO_CONFLICT' && value > 0) callbacks.current.onChange(0)
          else if (next.canSpend && value > next.maxSpend) callbacks.current.onChange(next.maxSpend)
        })
        .catch(() => {
          if (ignore) return
          setLoadFailed(true)
          callbacks.current.onQuote(null)
        })
    }, QUOTE_DELAY_MS)
    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [promoCode, value])

  if (isBonusDemo()) return null

  if (loadFailed) {
    return (
      <div className="bg-card border border-border rounded-block p-6">
        <p role="alert" className="text-sm text-destructive">
          Не удалось загрузить бонусы. Обновите страницу
        </p>
      </div>
    )
  }

  if (!quote || (quote.reason !== null && HIDDEN_REASONS.has(quote.reason))) return null
  if (quote.reason === null && !quote.canSpend) return null

  const handleInput = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, MAX_DIGITS)
    onChange(digits ? Number(digits) : 0)
  }

  const overLimit = quote.canSpend && value > quote.maxSpend
  const promoConflict = quote.reason === 'PROMO_CONFLICT'

  return (
    <div className="bg-card border border-border rounded-block p-6">
      <h2 className="text-base font-sans font-semibold text-foreground mb-4 uppercase tracking-wide">Бонусы</h2>

      {promoConflict && (
        <p id="bonus-promo-conflict" className="text-sm text-muted-foreground mb-4">
          Бонусы не суммируются с промокодом. Чтобы списать бонусы, уберите промокод.
        </p>
      )}

      {quote.reason === 'MIN_ORDER' && (
        <p className="text-sm text-muted-foreground">
          Списать бонусы можно при покупке от {formatPrice(quote.minOrderForSpend)}
        </p>
      )}

      {quote.reason === 'EMPTY_BALANCE' && (
        <p className="text-sm text-muted-foreground">Бонусов на балансе пока нет</p>
      )}

      {(quote.canSpend || promoConflict) && (
        <>
          <label htmlFor="bonus-spend" className="block text-sm text-foreground mb-2">
            Списать бонусы
          </label>
          <div className="flex gap-2">
            <input
              id="bonus-spend"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={value > 0 ? String(value) : ''}
              onChange={(e) => handleInput(e.target.value)}
              placeholder="0"
              disabled={promoConflict}
              aria-invalid={overLimit}
              aria-describedby={promoConflict ? 'bonus-promo-conflict' : undefined}
              className="flex-1 min-w-0 px-4 py-3 text-base rounded-pill border bg-background text-foreground tabular-nums placeholder-muted-foreground focus:outline-none transition-[border-color,box-shadow] duration-150 border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-60 disabled:cursor-not-allowed min-h-11"
            />
            <button
              type="button"
              onClick={() => callbacks.current.onChange(quote.maxSpend)}
              disabled={promoConflict}
              aria-label={`Списать все доступные бонусы: ${quote.maxSpend}`}
              className="shrink-0 px-5 py-3 border border-border-strong text-foreground font-bold rounded-pill hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed min-h-11"
            >
              Все
            </button>
          </div>
          {quote.canSpend && (
            <p className={`text-xs mt-2 tabular-nums ${overLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
              {overLimit
                ? `Больше лимита. Можно списать до ${quote.maxSpend} ${bonusWord(quote.maxSpend)}`
                : `Доступно ${quote.available} ${bonusWord(quote.available)}, можно списать до ${quote.maxSpend}`}
            </p>
          )}
        </>
      )}

      {quote.accrualPreview > 0 && (
        <p className="text-xs text-muted-foreground mt-3 tabular-nums">
          За заказ начислим ≈ {quote.accrualPreview} {bonusWord(quote.accrualPreview)} после получения
        </p>
      )}
    </div>
  )
}
