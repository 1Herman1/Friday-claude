import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  adminAdjustBonus,
  adminGetBonusAccount,
  type AdminBonusAccountDetail,
  type AdminBonusTx,
} from '@/lib/admin-api'
import { ApiError } from '@/lib/api'
import { BONUS_TYPE_LABELS, bonusWord, formatBonusDate } from '@/lib/bonus-labels'

const PAGE_SIZE = 20
const MAX_AMOUNT = 100_000
const INPUT = 'w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring min-h-11'
const LABEL = 'block text-sm font-sans text-muted-foreground mb-2'

export function AdminBonusAccountPage() {
  const { userId = '' } = useParams()
  const { user } = useAuth()
  const canAdjust = user?.role === 'super_admin' || user?.role === 'orders_manager'
  const [detail, setDetail] = useState<AdminBonusAccountDetail | null>(null)
  const [transactions, setTransactions] = useState<AdminBonusTx[]>([])
  const [loadFailed, setLoadFailed] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [amountText, setAmountText] = useState('')
  const [reason, setReason] = useState('')
  const [expiresText, setExpiresText] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [confirming, setConfirming] = useState<{ amount: number; reason: string; expiresInDays?: number } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    adminGetBonusAccount(userId, PAGE_SIZE, 0)
      .then((result) => {
        if (ignore) return
        setDetail(result)
        setTransactions(result.transactions)
      })
      .catch((err) => {
        if (!ignore) setLoadFailed(err instanceof ApiError && err.status === 404 ? 'Счёт не найден' : 'Не удалось загрузить счёт')
      })
    return () => {
      ignore = true
    }
  }, [userId])

  if (loadFailed) {
    return (
      <div className="container-app py-12">
        <p role="alert" className="text-sm text-destructive mb-4">{loadFailed}</p>
        <Link to="/admin/bonus" className="text-primary underline underline-offset-2 min-h-11 inline-flex items-center">К списку участников</Link>
      </div>
    )
  }
  if (!detail) return <div className="container-app py-12 text-muted-foreground">Загрузка…</div>

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const next = await adminGetBonusAccount(userId, PAGE_SIZE, transactions.length)
      setTransactions((prev) => [...prev, ...next.transactions])
      setDetail((prev) => (prev ? { ...prev, total: next.total } : prev))
    } catch {
      setFormError('Не удалось загрузить историю')
    } finally {
      setLoadingMore(false)
    }
  }

  const review = (event: FormEvent) => {
    event.preventDefault()
    setDone(null)
    const amount = Number(amountText)
    const trimmed = reason.trim()
    if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > MAX_AMOUNT) {
      setFormError(`Сумма — целое число от −${MAX_AMOUNT} до ${MAX_AMOUNT}, не ноль`)
      return
    }
    if (trimmed.length < 3 || trimmed.length > 300) {
      setFormError('Причина — от 3 до 300 символов. Без персональных данных')
      return
    }
    const days = expiresText.trim() === '' ? undefined : Number(expiresText)
    if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > 1825 || amount < 0)) {
      setFormError('Срок — от 1 до 1825 дней, только для начисления')
      return
    }
    setFormError(null)
    setConfirming({ amount, reason: trimmed, expiresInDays: days })
  }

  const apply = async () => {
    if (!confirming) return
    setSubmitting(true)
    setFormError(null)
    try {
      const result = await adminAdjustBonus(userId, {
        amount: confirming.amount,
        reason: confirming.reason,
        expiresInDays: confirming.expiresInDays,
        idempotencyKey,
      })
      setTransactions((prev) => [result.transaction, ...prev.filter((tx) => tx.id !== result.transaction.id)])
      setDetail((prev) =>
        prev ? { ...prev, account: { ...prev.account, balance: result.balance }, total: prev.total + 1 } : prev
      )
      setDone(`Готово: баланс ${result.balance} ${bonusWord(result.balance)}`)
      setAmountText('')
      setReason('')
      setExpiresText('')
      setConfirming(null)
      setIdempotencyKey(crypto.randomUUID())
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.code === 'BONUS_INSUFFICIENT'
          ? 'Недостаточно бонусов для списания'
          : err instanceof ApiError
            ? err.message
            : 'Не удалось провести корректировку. Попробуйте ещё раз'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const { account, nextExpiration, total } = detail

  return (
    <div className="container-app py-12 md:py-16">
      <Link to="/admin/bonus" className="inline-flex items-center min-h-11 text-sm font-semibold text-primary underline underline-offset-2 mb-6">
        К списку участников
      </Link>
      <h1 className="text-h2 font-heading font-bold text-foreground uppercase mb-2">{account.name || 'Участник'}</h1>
      <p className="text-sm text-muted-foreground mb-8">
        {account.email ?? '—'}{account.phone ? ` · ${account.phone}` : ''} · {account.member ? 'в клубе' : 'вышел из клуба'}
      </p>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="grid gap-6 content-start">
          <section aria-labelledby="bonus-acc-balance" className="p-6 rounded-block border border-border bg-card">
            <h2 id="bonus-acc-balance" className="text-label uppercase tracking-[0.08em] text-muted-foreground mb-2">Баланс</h2>
            <p className="text-h2 font-heading font-bold text-primary tabular-nums leading-none">
              {account.balance} {bonusWord(account.balance)}
            </p>
            {nextExpiration && (
              <p className="text-sm text-foreground mt-3">
                {nextExpiration.amount} {bonusWord(nextExpiration.amount)} сгорят {formatBonusDate(nextExpiration.expiresAt)}
              </p>
            )}
          </section>

          {canAdjust && (
            <section aria-labelledby="bonus-adjust-heading" className="p-6 rounded-block border border-border bg-card">
              <h2 id="bonus-adjust-heading" className="text-h3 font-heading font-semibold normal-case text-foreground mb-4">Корректировка</h2>
              {!confirming ? (
                <form onSubmit={review} className="grid gap-4">
                  <div>
                    <label htmlFor="bonus-amount" className={LABEL}>Сумма, бонусов (минус — списать)</label>
                    <input id="bonus-amount" type="text" inputMode="numeric" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="например, 50 или -20" className={INPUT} />
                  </div>
                  <div>
                    <label htmlFor="bonus-reason" className={LABEL}>Причина</label>
                    <textarea id="bonus-reason" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} className={INPUT} />
                    <p className="text-xs text-muted-foreground mt-1">Без персональных данных: причину видят все сотрудники</p>
                  </div>
                  <div>
                    <label htmlFor="bonus-expires" className={LABEL}>Срок, дней (только для начисления)</label>
                    <input id="bonus-expires" type="text" inputMode="numeric" value={expiresText} onChange={(e) => setExpiresText(e.target.value)} placeholder="по сроку программы" className={INPUT} />
                  </div>
                  {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
                  <button type="submit" className="justify-self-start px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill min-h-11">
                    Проверить и провести
                  </button>
                </form>
              ) : (
                <div className="grid gap-4">
                  <p className="text-sm text-foreground">
                    {confirming.amount > 0 ? 'Начислить' : 'Списать'} {Math.abs(confirming.amount)} {bonusWord(Math.abs(confirming.amount))}
                    {confirming.expiresInDays ? `, срок ${confirming.expiresInDays} дн.` : ''}. Причина: «{confirming.reason}». Проводим?
                  </p>
                  {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={apply} disabled={submitting} className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill disabled:opacity-50 min-h-11">
                      {submitting ? 'Проводим…' : 'Провести'}
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} disabled={submitting} className="px-6 py-3 border border-border-strong rounded-pill min-h-11">
                      Изменить
                    </button>
                  </div>
                </div>
              )}
              {done && <p role="status" className="text-sm text-foreground mt-4">{done}</p>}
            </section>
          )}
        </div>

        <section aria-labelledby="bonus-acc-history" className="self-start rounded-block border border-border bg-card overflow-x-auto">
          <h2 id="bonus-acc-history" className="text-h3 font-heading font-semibold normal-case text-foreground p-6 pb-4">История</h2>
          {transactions.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Операций пока нет</p>
          ) : (
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th scope="col" className="px-4 py-3 text-left text-muted-foreground font-semibold">Дата</th>
                  <th scope="col" className="px-4 py-3 text-left text-muted-foreground font-semibold">Операция</th>
                  <th scope="col" className="px-4 py-3 text-right text-muted-foreground font-semibold">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border last:border-b-0 align-top">
                    <td className="px-4 py-3 tabular-nums text-muted-foreground whitespace-nowrap">{formatBonusDate(tx.createdAt)}</td>
                    <td className="px-4 py-3 text-foreground">
                      <p>{BONUS_TYPE_LABELS[tx.type]}</p>
                      {tx.remaining !== null && tx.remaining > 0 && tx.expiresAt && (
                        <p className="text-xs text-muted-foreground">сгорит {formatBonusDate(tx.expiresAt)}</p>
                      )}
                      {tx.orderNumber && <p className="text-xs text-muted-foreground">Заказ {tx.orderNumber}</p>}
                      {tx.reason && <p className="text-xs text-foreground mt-1">Причина: {tx.reason}</p>}
                      {tx.createdBy && <p className="text-xs text-muted-foreground">Автор: {tx.createdBy.name}</p>}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${tx.amount > 0 ? 'text-success' : 'text-foreground'}`}>
                      {tx.amount > 0 ? '+' : '−'}
                      {Math.abs(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {transactions.length < total && (
            <div className="p-4">
              <button type="button" onClick={loadMore} disabled={loadingMore} className="px-5 py-2 border border-border-strong rounded-pill disabled:opacity-50 min-h-11">
                {loadingMore ? 'Загрузка…' : 'Показать ещё'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
