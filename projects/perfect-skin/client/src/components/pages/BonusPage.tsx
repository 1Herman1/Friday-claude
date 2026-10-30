import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api'
import {
  fetchBonusSummary,
  fetchBonusTransactions,
  leaveBonusClub,
  type BonusSummary,
  type BonusTx,
} from '@/lib/bonus-api'
import { BONUS_TYPE_LABELS, bonusWord, formatBonusDate, isBonusDemo } from '@/lib/bonus-labels'
import { formatPrice, pluralize } from '@/lib/format'

const PAGE_SIZE = 20
const SECTION = 'p-6 rounded-block border border-border bg-card'
const SECTION_HEADING = 'text-h3 font-heading font-semibold normal-case tracking-[-0.015em] text-foreground mb-4'
const SECONDARY_BUTTON =
  'inline-flex items-center px-6 py-3 border border-border-strong text-foreground font-bold rounded-pill hover:bg-muted transition-colors min-h-11'
const DESTRUCTIVE_BUTTON =
  'inline-flex items-center px-6 py-3 bg-destructive text-destructive-foreground font-bold rounded-pill hover:opacity-90 transition-opacity min-h-11 disabled:opacity-50'
const LEAVE_LINK =
  'text-sm text-muted-foreground underline underline-offset-2 min-h-11 inline-flex items-center'

function rulesLines(summary: BonusSummary): string[] {
  const { rules } = summary
  const trigger = rules.accrualTrigger === 'delivered' ? 'после получения заказа' : 'после оплаты заказа'
  const delay =
    rules.accrualDelayDays > 0
      ? `, через ${rules.accrualDelayDays} ${pluralize(rules.accrualDelayDays, ['день', 'дня', 'дней'])}`
      : ''
  const spendMin = rules.minOrderForSpend > 0 ? `, при покупке от ${formatPrice(rules.minOrderForSpend)}` : ''
  const ttl =
    rules.bonusTtlDays > 0
      ? `Бонусы сгорают через ${rules.bonusTtlDays} ${pluralize(rules.bonusTtlDays, ['день', 'дня', 'дней'])}`
      : 'Бонусы не сгорают'
  return [
    `Начисляем ${rules.accrualPercent}% от стоимости товаров ${trigger}${delay}`,
    `1 бонус = ${formatPrice(rules.kopecksPerBonus)}`,
    `Списать можно до ${rules.maxSpendPercent}% стоимости товаров${spendMin}`,
    rules.allowSpendWithPromo ? 'Бонусы можно сочетать с промокодом' : 'Бонусы не суммируются с промокодом',
    'Бонусами нельзя оплатить доставку',
    ttl,
  ]
}

export function BonusPage() {
  const navigate = useNavigate()
  const { isAuthed, isLoading: authLoading } = useAuth()
  const [summary, setSummary] = useState<BonusSummary | null>(null)
  const [items, setItems] = useState<BonusTx[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreFailed, setMoreFailed] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || isBonusDemo()) return
    if (!isAuthed) {
      navigate('/auth?next=/bonus')
      return
    }
    let ignore = false
    Promise.all([fetchBonusSummary(), fetchBonusTransactions(PAGE_SIZE, 0)])
      .then(([value, list]) => {
        if (ignore) return
        setSummary(value)
        setItems(list.items)
        setTotal(list.total)
        setStatus('ready')
      })
      .catch(() => {
        if (!ignore) setStatus('error')
      })
    return () => {
      ignore = true
    }
  }, [authLoading, isAuthed, navigate])

  if (isBonusDemo()) {
    return (
      <div className="container-app py-12 md:py-20 text-center text-muted-foreground">
        Бонусы недоступны в демо-версии сайта
      </div>
    )
  }

  if (status === 'loading') {
    return <div className="container-app py-12 text-center text-muted-foreground">Загрузка…</div>
  }

  if (status === 'error' || !summary) {
    return (
      <div className="container-app py-12 md:py-20">
        <p role="alert" className="text-sm text-destructive">
          Не удалось загрузить бонусы. Обновите страницу
        </p>
      </div>
    )
  }

  const loadMore = async () => {
    setLoadingMore(true)
    setMoreFailed(false)
    try {
      const list = await fetchBonusTransactions(PAGE_SIZE, items.length)
      setItems((prev) => [...prev, ...list.items])
      setTotal(list.total)
    } catch {
      setMoreFailed(true)
    } finally {
      setLoadingMore(false)
    }
  }

  const leave = async () => {
    setLeaving(true)
    setLeaveError(null)
    try {
      setSummary(await leaveBonusClub())
      setConfirmLeave(false)
    } catch (err) {
      setLeaveError(err instanceof ApiError ? err.message : 'Не удалось выйти из клуба. Попробуйте ещё раз')
    } finally {
      setLeaving(false)
    }
  }

  const { balance, balanceValue, nextExpiration, member, programEnabled } = summary

  return (
    <div className="container-app py-12 md:py-16">
      <h1 className="text-h3 md:text-h2 font-heading font-bold text-foreground mb-8 uppercase tracking-tight">
        Мои бонусы
      </h1>

      <div className="grid gap-6 max-w-2xl lg:max-w-none lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-6 lg:items-start">
        <div className="grid gap-6">
          <section aria-labelledby="bonus-balance-heading" className={SECTION}>
            <h2 id="bonus-balance-heading" className="text-label uppercase tracking-[0.08em] text-muted-foreground mb-2">
              Баланс
            </h2>
            <p className="text-h2 font-heading font-bold text-primary tabular-nums leading-none">
              {balance} {bonusWord(balance)}
            </p>
            <p className="text-sm text-muted-foreground tabular-nums mt-2">≈ {formatPrice(balanceValue)}</p>
            {nextExpiration && (
              <p className="text-sm text-foreground mt-4">
                {nextExpiration.amount} {bonusWord(nextExpiration.amount)} сгорят{' '}
                {formatBonusDate(nextExpiration.expiresAt)}
              </p>
            )}
            {!member && (
              <p className="text-sm text-muted-foreground mt-4">
                Вы не участник клуба: остаток сохранён, копить и тратить бонусы сейчас нельзя.{' '}
                <Link to="/orders" className="underline font-semibold text-primary">
                  Вступить в кабинете
                </Link>
              </p>
            )}
            {member && !programEnabled && (
              <p className="text-sm text-muted-foreground mt-4">Программа пока приостановлена, баланс сохранён.</p>
            )}
          </section>
          <section aria-labelledby="bonus-rules-heading" className={SECTION}>
            <h2 id="bonus-rules-heading" className={SECTION_HEADING}>Как это работает</h2>
            <ul className="space-y-2 text-sm text-foreground list-disc pl-5">
              {rulesLines(summary).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <Link to="/club/rules" className="inline-flex items-center min-h-11 mt-2 text-sm font-semibold text-primary underline underline-offset-2">
              Правила Бьюти-клуба
            </Link>
            {member && (
              <div className="mt-2">
                {!confirmLeave ? (
                  <button type="button" onClick={() => setConfirmLeave(true)} className={LEAVE_LINK}>
                    Выйти из клуба
                  </button>
                ) : (
                  <div>
                    <p className="text-sm text-foreground mb-4">
                      Остаток {balance} {bonusWord(balance)} будет заморожен до утверждения правил программы. Выйти из клуба?
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" onClick={leave} disabled={leaving} className={DESTRUCTIVE_BUTTON}>
                        {leaving ? 'Выходим…' : 'Да, выйти'}
                      </button>
                      <button type="button" onClick={() => setConfirmLeave(false)} disabled={leaving} className={SECONDARY_BUTTON}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {leaveError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {leaveError}
              </p>
            )}
          </section>
        </div>
        <section aria-labelledby="bonus-history-heading" className={SECTION}>
          <h2 id="bonus-history-heading" className={SECTION_HEADING}>История</h2>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Операций пока нет</p>
          ) : (
            <ul>
              {items.map((tx) => (
                <li key={tx.id} className="flex flex-wrap items-start justify-between gap-3 py-3 border-b border-border last:border-b-0">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{BONUS_TYPE_LABELS[tx.type]}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatBonusDate(tx.createdAt)}
                      {tx.orderNumber && (
                        <>
                          {' · '}
                          <Link to={`/orders/${tx.orderNumber}`} className="relative underline after:absolute after:-inset-y-3 after:inset-x-0">
                            Заказ {tx.orderNumber}
                          </Link>
                        </>
                      )}
                    </p>
                    {tx.remaining !== null && tx.remaining > 0 && tx.expiresAt && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {tx.remaining} {bonusWord(tx.remaining)} сгорят {formatBonusDate(tx.expiresAt)}
                      </p>
                    )}
                  </div>
                  <p
                    className={`text-sm font-heading font-bold tabular-nums ${tx.amount > 0 ? 'text-success' : 'text-foreground'}`}
                  >
                    {tx.amount > 0 ? '+' : '−'}
                    {Math.abs(tx.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {items.length < total && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={loadMore} disabled={loadingMore} className={SECONDARY_BUTTON}>
                {loadingMore ? 'Загрузка…' : 'Показать ещё'}
              </button>
              {moreFailed && (
                <p role="alert" className="text-sm text-destructive">
                  Не удалось загрузить историю
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
