import { useState } from 'react'
import {
  adminCdekPrint,
  adminGetOrder,
  adminCdekRefresh,
  adminCdekSubmit,
  type AdminCdek,
  type AdminOrderDetail,
} from '@/lib/admin-api'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

interface CdekPanelProps {
  order: AdminOrderDetail
  onUpdated: (order: AdminOrderDetail) => void
}

type Busy = 'submit' | 'force' | 'refresh' | 'waybill' | 'barcode' | null

const STATE_LABELS: Record<NonNullable<AdminCdek['state']> | 'none', string> = {
  none: 'Не передан',
  creating: 'Передаём…',
  accepted: 'Принят, ждём номер',
  created: 'Создан',
  invalid: 'Ошибка',
}

const BUTTON =
  'px-4 py-2 font-sans font-semibold rounded-block transition-colors min-h-11 disabled:opacity-50 disabled:cursor-not-allowed'

function rejectedMessages(error: ApiError): string[] {
  const messages = error.details?.messages
  return Array.isArray(messages) ? messages.map(String) : []
}

export function CdekPanel({ order, onUpdated }: CdekPanelProps) {
  const cdek = order.cdek
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState('')
  const [errorLines, setErrorLines] = useState<string[]>([])
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'

  if (order.deliveryMethod === 'pickup') return null

  const stateKey = cdek.state ?? 'none'
  const isCreated = cdek.state === 'created'
  const canRefresh = cdek.state === 'accepted' || cdek.state === 'created'
  const cancelledButCreated = order.status === 'cancelled' && isCreated

  const perform = async (kind: Busy, action: () => Promise<AdminOrderDetail>) => {
    setBusy(kind)
    setError('')
    setErrorLines([])
    try {
      onUpdated(await action())
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        setErrorLines(err.code === 'CDEK_REJECTED' ? rejectedMessages(err) : [])
        if (err.code === 'CDEK_REJECTED' || err.code === 'CDEK_UNAVAILABLE') {
          onUpdated(await adminGetOrder(order.id))
        }
      } else {
        setError('Нет соединения с сервером')
      }
    } finally {
      setBusy(null)
    }
  }

  const submitWithoutPayment = () => {
    if (!window.confirm('Заказ не оплачен. Всё равно передать в СДЭК? Действие фиксируется.')) return
    void perform('force', () => adminCdekSubmit(order.id, true))
  }

  const downloadPrint = async (kind: 'waybill' | 'barcode') => {
    setBusy(kind)
    setError('')
    setErrorLines([])
    try {
      const blob = await adminCdekPrint(order.id, kind)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cdek-${order.number}-${kind}.pdf`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Нет соединения с сервером')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="bg-card border border-border rounded-block p-6" aria-labelledby="cdek-panel-title">
      <h2 id="cdek-panel-title" className="text-lg font-heading font-semibold text-foreground mb-4">
        Доставка СДЭК
      </h2>

      {!cdek.enabled && (
        <p className="text-sm text-muted-foreground">Интеграция с СДЭК выключена: передача и печать недоступны.</p>
      )}

      {cdek.enabled && (
        <div className="space-y-4">
          <div aria-live="polite" className="space-y-1">
            <p className="text-sm text-foreground">
              <span className="font-semibold">Состояние:</span> {STATE_LABELS[stateKey]}
            </p>
            {cdek.number && (
              <p className="text-sm text-foreground">
                <span className="font-semibold">Трек-номер:</span> {cdek.number}{' '}
                <a
                  href={`https://www.cdek.ru/ru/tracking?order_id=${encodeURIComponent(cdek.number)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Открыть на сайте СДЭК
                </a>
              </p>
            )}
            {cdek.statusName && (
              <p className="text-sm text-foreground">
                <span className="font-semibold">Статус перевозчика:</span> {cdek.statusName}
                {cdek.statusAt && ` (${new Date(cdek.statusAt).toLocaleString('ru-RU')})`}
              </p>
            )}
            {cdek.state === 'invalid' && (
              <div className="text-sm text-destructive">
                <p>Ошибка СДЭК:</p>
                {cdek.error && (
                  <ul className="list-disc pl-5">
                    {cdek.error.split('; ').map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {cancelledButCreated && (
            <p className="bg-destructive/10 text-destructive text-sm p-3 rounded-block">
              Заказ отменён у нас — отмените его в кабинете СДЭК.
            </p>
          )}

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-block space-y-1">
              <p>{error}</p>
              {errorLines.length > 0 && (
                <ul className="list-disc pl-5">
                  {errorLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {cdek.canSubmit && (
              <button
                type="button"
                onClick={() => perform('submit', () => adminCdekSubmit(order.id))}
                disabled={busy !== null}
                className={`${BUTTON} bg-primary text-primary-foreground hover:bg-primary/90`}
              >
                {busy === 'submit' ? 'Передаём…' : 'Передать в СДЭК'}
              </button>
            )}
            {cdek.awaitingPayment && (
              <div className="w-full space-y-2">
                <button
                  type="button"
                  disabled
                  aria-describedby="cdek-payment-hint"
                  className={`${BUTTON} bg-primary text-primary-foreground`}
                >
                  Передать в СДЭК
                </button>
                <p id="cdek-payment-hint" className="text-sm text-muted-foreground">
                  Сначала отметьте оплату заказа.
                </p>
              </div>
            )}
            {cdek.awaitingPayment && isSuperAdmin && (
              <button
                type="button"
                onClick={submitWithoutPayment}
                disabled={busy !== null}
                className={`${BUTTON} border border-destructive text-destructive hover:bg-destructive/10`}
              >
                {busy === 'force' ? 'Передаём…' : 'Передать без оплаты'}
              </button>
            )}
            {canRefresh && (
              <button
                type="button"
                onClick={() => perform('refresh', () => adminCdekRefresh(order.id))}
                disabled={busy !== null}
                className={`${BUTTON} border border-border-strong text-foreground hover:bg-muted`}
              >
                {busy === 'refresh' ? 'Обновляем…' : 'Обновить статус'}
              </button>
            )}
            {isCreated && (
              <>
                <button
                  type="button"
                  onClick={() => downloadPrint('waybill')}
                  disabled={busy !== null}
                  className={`${BUTTON} border border-border-strong text-foreground hover:bg-muted`}
                >
                  {busy === 'waybill' ? 'Готовим…' : 'Накладная (PDF)'}
                </button>
                <button
                  type="button"
                  onClick={() => downloadPrint('barcode')}
                  disabled={busy !== null}
                  className={`${BUTTON} border border-border-strong text-foreground hover:bg-muted`}
                >
                  {busy === 'barcode' ? 'Готовим…' : 'Штрихкод (PDF)'}
                </button>
              </>
            )}
          </div>

          {cdek.history.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">История статусов</h3>
              <ol className="space-y-1 text-sm text-muted-foreground">
                {cdek.history.map((event) => (
                  <li key={`${event.code}-${event.occurredAt}`}>
                    {new Date(event.occurredAt).toLocaleString('ru-RU')} — {event.name ?? event.code}
                    {event.city ? `, ${event.city}` : ''}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
