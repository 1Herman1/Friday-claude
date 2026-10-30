import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  adminGetBonusSettings,
  adminUpdateBonusSettings,
  type AdminBonusSettings,
  type AdminBonusSettingsResponse,
} from '@/lib/admin-api'
import { ApiError } from '@/lib/api'
import { formatPrice } from '@/lib/format'

type SettingsForm = Omit<AdminBonusSettings, 'updatedAt' | 'updatedBy' | 'minOrderForSpend'> & { minOrderRub: string }

const FIELD_LABELS: Record<string, string> = {
  enabled: 'Программа включена',
  accrualPercent: 'Процент начисления',
  accrualBase: 'База начисления',
  accrualTrigger: 'Начисление',
  accrualDelayDays: 'Задержка начисления, дней',
  excludeProfessionalProducts: 'Кабинетные товары не начисляют',
  accrueWithPromo: 'Начислять при промокоде',
  kopecksPerBonus: 'Курс, копеек за бонус',
  maxSpendPercent: 'Лимит списания, % товаров',
  minOrderForSpend: 'Минимальная сумма для списания',
  allowSpendWithPromo: 'Списание вместе с промокодом',
  bonusTtlDays: 'Срок жизни начислений, дней',
  refundMinTtlDays: 'Минимальный срок возврата, дней',
  welcomeBonus: 'Приветственные бонусы',
  welcomeTtlDays: 'Срок приветственных, дней',
  reviewBonus: 'Бонус за отзыв (задел)',
  reviewTtlDays: 'Срок бонуса за отзыв (задел)',
  expiryNoticeKind: 'Тип письма о сгорании (задел)',
  expiryNoticeDaysBefore: 'Письмо за дней до сгорания (задел)',
}

const ACCRUAL_BASE_LABELS: Record<AdminBonusSettings['accrualBase'], string> = {
  paid_goods: 'Товары за вычетом промокода и бонусов',
  after_promo: 'Товары за вычетом промокода',
  gross: 'Товары без скидок',
}

const TRIGGER_LABELS: Record<AdminBonusSettings['accrualTrigger'], string> = {
  delivered: 'когда заказ доставлен',
  paid: 'когда заказ оплачен',
}

const NOTICE_LABELS: Record<AdminBonusSettings['expiryNoticeKind'], string> = {
  service: 'Сервисное',
  advertising: 'Рекламное',
}

const INPUT = 'w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring disabled:opacity-60 min-h-11'
const LABEL = 'block text-label font-sans text-muted-foreground mb-2'
const CHECK_ROW = 'flex items-start gap-3 min-h-11 cursor-pointer'
const CHECKBOX = 'w-5 h-5 mt-0.5 flex-shrink-0 rounded border border-border-strong checked:bg-primary checked:border-primary disabled:cursor-not-allowed'

function toForm(settings: AdminBonusSettings): SettingsForm {
  const { updatedAt, updatedBy, minOrderForSpend, ...rest } = settings
  return { ...rest, minOrderRub: String(minOrderForSpend / 100) }
}

function toKopecks(rub: string): number {
  return Math.round(Number(rub.replace(',', '.')) * 100)
}

function formatValue(key: string, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'да' : 'нет'
  if (key === 'minOrderForSpend' && typeof value === 'number') return formatPrice(value)
  if (key === 'accrualBase' && typeof value === 'string') return ACCRUAL_BASE_LABELS[value as AdminBonusSettings['accrualBase']]
  if (key === 'accrualTrigger' && typeof value === 'string') return TRIGGER_LABELS[value as AdminBonusSettings['accrualTrigger']]
  if (key === 'expiryNoticeKind' && typeof value === 'string') return NOTICE_LABELS[value as AdminBonusSettings['expiryNoticeKind']]
  return String(value)
}

function changedFields(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  return Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
}

export function AdminBonusSettingsPage() {
  const { user } = useAuth()
  const canEdit = user?.role === 'super_admin'
  const [data, setData] = useState<AdminBonusSettingsResponse | null>(null)
  const [form, setForm] = useState<SettingsForm | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const applyResponse = (response: AdminBonusSettingsResponse) => {
    setData(response)
    setForm(toForm(response.settings))
    setLoadFailed(false)
  }

  useEffect(() => {
    let ignore = false
    adminGetBonusSettings()
      .then((response) => {
        if (!ignore) applyResponse(response)
      })
      .catch(() => {
        if (!ignore) setLoadFailed(true)
      })
    return () => {
      ignore = true
    }
  }, [])

  if (loadFailed) {
    return (
      <div className="container-app py-12">
        <p role="alert" className="text-sm text-destructive">Не удалось загрузить настройки бонусов</p>
      </div>
    )
  }
  if (!data || !form) {
    return <div className="container-app py-12 text-muted-foreground">Загрузка…</div>
  }

  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const { minOrderRub, ...rest } = form
    setSaving(true)
    setMessage(null)
    try {
      const response = await adminUpdateBonusSettings({
        ...rest,
        minOrderForSpend: toKopecks(minOrderRub),
        expectedUpdatedAt: data.settings.updatedAt,
      })
      applyResponse(response)
      setMessage({ kind: 'ok', text: 'Настройки сохранены' })
    } catch (err) {
      const text =
        err instanceof ApiError && err.code === 'SETTINGS_CONFLICT'
          ? 'Настройки изменил другой сотрудник. Обновите страницу'
          : err instanceof ApiError && err.code === 'RULES_NOT_PUBLISHED'
            ? 'Правила Бьюти-клуба ещё не утверждены: программу нельзя включить'
            : err instanceof ApiError
              ? err.message
              : 'Не удалось сохранить. Попробуйте ещё раз'
      setMessage({ kind: 'error', text })
    } finally {
      setSaving(false)
    }
  }

  const rateChanged = data.settings.enabled && form.kopecksPerBonus !== data.settings.kopecksPerBonus
  const number = (key: keyof SettingsForm, min: number, max: number, label: string, hint?: string) => (
    <div>
      <label htmlFor={`bs-${key}`} className={LABEL}>{label}</label>
      <input
        id={`bs-${key}`}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={String(form[key])}
        disabled={!canEdit}
        onChange={(e) => set(key, Number(e.target.value) as SettingsForm[typeof key])}
        className={INPUT}
      />
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  )
  const check = (key: 'excludeProfessionalProducts' | 'accrueWithPromo' | 'allowSpendWithPromo', label: string) => (
    <label className={CHECK_ROW}>
      <input type="checkbox" checked={form[key]} disabled={!canEdit} onChange={(e) => set(key, e.target.checked)} className={CHECKBOX} />
      <span className="text-sm text-foreground leading-snug">{label}</span>
    </label>
  )

  return (
    <div className="container-app py-12 md:py-16">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-h2 font-heading font-bold text-foreground uppercase">Бонусы: настройки</h1>
        <Link to="/admin/bonus" className="text-sm font-semibold text-primary underline underline-offset-2 min-h-11 inline-flex items-center">
          Участники
        </Link>
      </div>

      {!canEdit && (
        <p className="text-sm text-muted-foreground mb-6">Только просмотр: менять настройки может суперадминистратор</p>
      )}

      <form onSubmit={save} className="grid gap-8 max-w-3xl">
        <section className="p-6 rounded-block border border-border bg-card">
          <label className={CHECK_ROW}>
            <input type="checkbox" checked={form.enabled} disabled={!canEdit} onChange={(e) => set('enabled', e.target.checked)} className={CHECKBOX} />
            <span className="text-sm text-foreground font-semibold leading-snug">Программа включена</span>
          </label>
          <p className="text-xs text-muted-foreground mt-2">
            Включать после утверждения правил клиентом и юристом. Пока правила в статусе черновика, сервер не даст включить программу.
          </p>
          {rateChanged && (
            <p role="alert" className="text-sm text-urgency mt-3">
              Смена курса меняет стоимость всех накопленных бонусов
            </p>
          )}
        </section>

        <fieldset className="p-6 rounded-block border border-border bg-card grid gap-6 sm:grid-cols-2">
          <legend className="text-h3 font-heading font-semibold text-foreground mb-2">Начисление</legend>
          {number('accrualPercent', 0, 100, 'Процент начисления')}
          <div>
            <label htmlFor="bs-accrualTrigger" className={LABEL}>Начисление</label>
            <select id="bs-accrualTrigger" value={form.accrualTrigger} disabled={!canEdit} onChange={(e) => set('accrualTrigger', e.target.value as SettingsForm['accrualTrigger'])} className={INPUT}>
              <option value="delivered">Когда заказ доставлен</option>
              <option value="paid">Когда заказ оплачен</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="bs-accrualBase" className={LABEL}>База начисления</label>
            <select id="bs-accrualBase" value={form.accrualBase} disabled={!canEdit} onChange={(e) => set('accrualBase', e.target.value as SettingsForm['accrualBase'])} className={INPUT}>
              {(Object.keys(ACCRUAL_BASE_LABELS) as AdminBonusSettings['accrualBase'][]).map((base) => (
                <option key={base} value={base}>{ACCRUAL_BASE_LABELS[base]}</option>
              ))}
            </select>
          </div>
          {number('accrualDelayDays', 0, 60, 'Задержка начисления, дней')}
          <div className="sm:col-span-2 grid gap-3">
            {check('excludeProfessionalProducts', 'Кабинетные товары не начисляют бонусы')}
            {check('accrueWithPromo', 'Начислять бонусы по заказу с промокодом')}
          </div>
        </fieldset>

        <fieldset className="p-6 rounded-block border border-border bg-card grid gap-6 sm:grid-cols-2">
          <legend className="text-h3 font-heading font-semibold text-foreground mb-2">Списание</legend>
          {number('kopecksPerBonus', 1, 10000, 'Курс, копеек за бонус', '100 = 1 бонус равен 1 ₽')}
          {number('maxSpendPercent', 0, 100, 'Лимит списания, % товаров')}
          <div>
            <label htmlFor="bs-minOrderRub" className={LABEL}>Минимальная сумма товаров для списания, ₽</label>
            <input id="bs-minOrderRub" type="text" inputMode="decimal" value={form.minOrderRub} disabled={!canEdit} onChange={(e) => set('minOrderRub', e.target.value)} className={INPUT} />
          </div>
          <div className="sm:col-span-2">
            {check('allowSpendWithPromo', 'Списание вместе с промокодом')}
          </div>
        </fieldset>

        <fieldset className="p-6 rounded-block border border-border bg-card grid gap-6 sm:grid-cols-2">
          <legend className="text-h3 font-heading font-semibold text-foreground mb-2">Сроки и приветственные</legend>
          {number('bonusTtlDays', 0, 1825, 'Срок жизни начислений, дней', '0 — бонусы не сгорают')}
          {number('refundMinTtlDays', 1, 365, 'Минимальный срок возвращённых бонусов, дней')}
          {number('welcomeBonus', 0, 5000, 'Приветственные бонусы')}
          {number('welcomeTtlDays', 1, 365, 'Срок приветственных, дней')}
          {number('reviewBonus', 0, 2000, 'Бонус за отзыв (задел, не используется)')}
          {number('reviewTtlDays', 1, 365, 'Срок бонуса за отзыв (задел)')}
          <div>
            <label htmlFor="bs-expiryNoticeKind" className={LABEL}>Тип письма о сгорании (задел)</label>
            <select id="bs-expiryNoticeKind" value={form.expiryNoticeKind} disabled={!canEdit} onChange={(e) => set('expiryNoticeKind', e.target.value as SettingsForm['expiryNoticeKind'])} className={INPUT}>
              <option value="advertising">Рекламное</option>
              <option value="service">Сервисное</option>
            </select>
          </div>
          {number('expiryNoticeDaysBefore', 1, 30, 'Письмо за дней до сгорания (задел)')}
        </fieldset>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={saving} className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-pill disabled:opacity-50 min-h-11">
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
            {message && (
              <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-destructive' : 'text-foreground'}`}>
                {message.text}
              </p>
            )}
          </div>
        )}
      </form>

      <section aria-labelledby="bonus-changes-heading" className="max-w-3xl mt-12">
        <h2 id="bonus-changes-heading" className="text-h3 font-heading font-semibold text-foreground mb-4">История изменений</h2>
        {data.changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Изменений пока не было</p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-block bg-card">
            {data.changes.map((change) => {
              const fields = changedFields(change.before, change.after)
              return (
                <li key={change.id} className="p-4 text-sm">
                  <p className="text-muted-foreground tabular-nums mb-1">
                    {new Date(change.createdAt).toLocaleString('ru-RU')} · {change.changedBy.name}
                  </p>
                  <ul className="space-y-1">
                    {fields.map((field) => (
                      <li key={field} className="text-foreground">
                        {FIELD_LABELS[field] ?? field}: {formatValue(field, change.before[field as keyof typeof change.before])} → {formatValue(field, change.after[field as keyof typeof change.after])}
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
