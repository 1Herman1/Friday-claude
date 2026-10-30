import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api'
import { fetchBonusSummary, joinBonusClub, type BonusSummary } from '@/lib/bonus-api'
import { bonusWord, formatBonusDate, isBonusDemo } from '@/lib/bonus-labels'
import { formatPrice } from '@/lib/format'

const HEADING = 'text-h3 font-heading font-semibold normal-case tracking-[-0.015em] text-foreground mb-4'
const LINK_BUTTON =
  'inline-flex items-center px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill hover:opacity-90 transition-opacity min-h-11'

export function BonusSection() {
  const { isAuthed, isLoading } = useAuth()
  const [summary, setSummary] = useState<BonusSummary | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading || !isAuthed || isBonusDemo()) return
    let ignore = false
    fetchBonusSummary()
      .then((value) => {
        if (!ignore) setSummary(value)
      })
      .catch(() => {
        if (!ignore) setLoadFailed(true)
      })
    return () => {
      ignore = true
    }
  }, [isAuthed, isLoading])

  if (isBonusDemo() || isLoading || !isAuthed) return null

  if (loadFailed) {
    return (
      <section className="p-6 rounded-block border border-border bg-card">
        <p role="alert" className="text-sm text-destructive">
          Не удалось загрузить бонусы Бьюти-клуба
        </p>
      </section>
    )
  }

  if (!summary || !summary.eligible || (!summary.programEnabled && !summary.member)) return null

  const join = async () => {
    setJoining(true)
    setJoinError(null)
    try {
      setSummary(await joinBonusClub())
    } catch (err) {
      setJoinError(err instanceof ApiError ? err.message : 'Не удалось вступить. Попробуйте ещё раз')
    } finally {
      setJoining(false)
    }
  }

  if (!summary.member) {
    return (
      <section aria-labelledby="bonus-section-heading" className="p-6 rounded-block border border-border bg-card">
        <h2 id="bonus-section-heading" className={HEADING}>Бьюти-клуб</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Бонусы за покупки: они копятся после получения заказа и идут в оплату следующих.
        </p>
        <label className="flex items-start gap-3 cursor-pointer min-h-11">
          <input
            type="checkbox"
            checked={accepted}
            disabled={joining}
            onChange={(e) => setAccepted(e.target.checked)}
            className="w-5 h-5 mt-0.5 flex-shrink-0 rounded border border-border-strong checked:bg-primary checked:border-primary cursor-pointer"
          />
          <span className="text-sm text-foreground leading-snug">Принимаю Правила Бьюти-клуба</span>
        </label>
        <Link to="/club/rules" className="inline-flex items-center min-h-11 mb-2 ml-8 text-sm font-semibold text-primary underline underline-offset-2">
          Читать правила
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={join}
            disabled={!accepted || joining}
            className={`${LINK_BUTTON} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {joining ? 'Вступаем…' : 'Вступить'}
          </button>
        </div>
        {joinError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {joinError}
          </p>
        )}
      </section>
    )
  }

  return (
    <section aria-labelledby="bonus-section-heading" className="p-6 rounded-block border border-border bg-card">
      <h2 id="bonus-section-heading" className={HEADING}>Бьюти-клуб</h2>
      <p className="text-h3 font-heading font-bold text-primary tabular-nums">
        {summary.balance} {bonusWord(summary.balance)}
      </p>
      <p className="text-sm text-muted-foreground tabular-nums mb-2">≈ {formatPrice(summary.balanceValue)}</p>
      {summary.nextExpiration && (
        <p className="text-sm text-foreground mb-4">
          {summary.nextExpiration.amount} {bonusWord(summary.nextExpiration.amount)} сгорят{' '}
          {formatBonusDate(summary.nextExpiration.expiresAt)}
        </p>
      )}
      <Link to="/bonus" className={LINK_BUTTON}>
        Мои бонусы
      </Link>
    </section>
  )
}
