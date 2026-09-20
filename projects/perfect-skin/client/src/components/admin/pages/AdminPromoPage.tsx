import { useEffect, useState } from 'react'
import {
  adminListPartners,
  adminCreatePartner,
  adminUpdatePartner,
  adminListPromoCodes,
  adminCreatePromoCode,
  adminUpdatePromoCode,
  adminGetPayoutReport,
  type AdminPartner,
  type AdminPromoCode,
  type PayoutReport,
} from '@/lib/admin-api'
import { ApiError } from '@/lib/api'
import { formatPrice } from '@/lib/format'

type Tab = 'codes' | 'partners' | 'report'

export function AdminPromoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('codes')
  const [error, setError] = useState('')

  return (
    <div className="container-app py-12 md:py-16">
      <h1 className="text-h2 font-heading font-bold text-foreground mb-8 uppercase">
        Промокоды
      </h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-border">
        <button
          onClick={() => setActiveTab('codes')}
          className={`px-4 py-3 font-sans font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'codes'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Промокоды
        </button>
        <button
          onClick={() => setActiveTab('partners')}
          className={`px-4 py-3 font-sans font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'partners'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Партнёры
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`px-4 py-3 font-sans font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'report'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Отчёт
        </button>
      </div>

      {/* Global error */}
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-block mb-6">
          {error}
        </div>
      )}

      {/* Content */}
      {activeTab === 'codes' && <PromoCodesTab onError={setError} />}
      {activeTab === 'partners' && <PartnersTab onError={setError} />}
      {activeTab === 'report' && <ReportTab onError={setError} />}
    </div>
  )
}

// ──────────────────────────────── ПРОМОКОДЫ ────────────────────────────────

function PromoCodesTab({ onError }: { onError: (msg: string) => void }) {
  const [codes, setCodes] = useState<AdminPromoCode[]>([])
  const [partners, setPartners] = useState<AdminPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [formError, setFormError] = useState('')

  const [formCode, setFormCode] = useState('')
  const [formPercent, setFormPercent] = useState('15')
  const [formPartnerId, setFormPartnerId] = useState('')

  const load = async () => {
    setLoading(true)
    setFormError('')
    onError('')
    try {
      const [codesData, partnersData] = await Promise.all([
        adminListPromoCodes(),
        adminListPartners(),
      ])
      setCodes(codesData)
      setPartners(partnersData)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Ошибка загрузки'
      setFormError(msg)
      onError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formCode.trim()) return

    setFormError('')
    try {
      await adminCreatePromoCode({
        code: formCode,
        percent: parseInt(formPercent),
        partnerId: formPartnerId || undefined,
      })
      setFormCode('')
      setFormPercent('15')
      setFormPartnerId('')
      await load()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Ошибка создания'
      setFormError(msg)
    }
  }

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await adminUpdatePromoCode(id, { isActive: !isActive })
      await load()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Ошибка обновления'
      setFormError(msg)
    }
  }

  return (
    <>
      {/* Form */}
      <div className="bg-card border border-border rounded-block p-6 mb-8">
        <h2 className="text-lg font-heading font-bold text-foreground mb-4">Новый промокод</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-block">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-label font-sans text-muted-foreground mb-2">
                Код
              </label>
              <input
                type="text"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                placeholder="SUMMER20"
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-label font-sans text-muted-foreground mb-2">
                Скидка %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formPercent}
                onChange={(e) => setFormPercent(e.target.value)}
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-label font-sans text-muted-foreground mb-2">
                Партнёр
              </label>
              <select
                value={formPartnerId}
                onChange={(e) => setFormPartnerId(e.target.value)}
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring"
              >
                <option value="">Нет</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full px-6 py-2 bg-primary text-primary-foreground font-sans font-semibold rounded-block hover:bg-primary/90 transition-colors min-h-11"
              >
                Создать
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">Код</th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Скидка
                </th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Партнёр
                </th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Применений
                </th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Статус
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Загрузка…
                  </td>
                </tr>
              ) : codes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Нет промокодов
                  </td>
                </tr>
              ) : (
                codes.map((code) => (
                  <tr key={code.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-6 py-4 font-semibold text-foreground">{code.code}</td>
                    <td className="px-6 py-4 text-foreground">{code.percent}%</td>
                    <td className="px-6 py-4 text-foreground">
                      {code.partner ? code.partner.name : '—'}
                    </td>
                    <td className="px-6 py-4 text-foreground">{code.usedCount}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggle(code.id, code.isActive)}
                        className={`px-3 py-1 rounded-pill text-xs font-semibold transition-colors ${
                          code.isActive
                            ? 'bg-success/10 text-success hover:bg-success/20'
                            : 'bg-muted text-muted-foreground hover:bg-muted/60'
                        }`}
                      >
                        {code.isActive ? 'Активен' : 'Отключен'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ──────────────────────────────── ПАРТНЁРЫ ────────────────────────────────

function PartnersTab({ onError }: { onError: (msg: string) => void }) {
  const [partners, setPartners] = useState<AdminPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [formError, setFormError] = useState('')

  const [formName, setFormName] = useState('')
  const [formContact, setFormContact] = useState('')
  const [formCommission, setFormCommission] = useState('10')

  const load = async () => {
    setLoading(true)
    setFormError('')
    onError('')
    try {
      const data = await adminListPartners()
      setPartners(data)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Ошибка загрузки'
      setFormError(msg)
      onError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) return

    setFormError('')
    try {
      await adminCreatePartner({
        name: formName,
        contact: formContact || undefined,
        commissionPercent: parseInt(formCommission),
      })
      setFormName('')
      setFormContact('')
      setFormCommission('10')
      await load()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Ошибка создания'
      setFormError(msg)
    }
  }

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await adminUpdatePartner(id, { isActive: !isActive })
      await load()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Ошибка обновления'
      setFormError(msg)
    }
  }

  return (
    <>
      {/* Form */}
      <div className="bg-card border border-border rounded-block p-6 mb-8">
        <h2 className="text-lg font-heading font-bold text-foreground mb-4">Новый партнёр</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-block">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-label font-sans text-muted-foreground mb-2">
                Имя
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Иван Петров"
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-label font-sans text-muted-foreground mb-2">
                Контакт
              </label>
              <input
                type="text"
                value={formContact}
                onChange={(e) => setFormContact(e.target.value)}
                placeholder="telegram: @ivan"
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-label font-sans text-muted-foreground mb-2">
                % комиссии
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formCommission}
                onChange={(e) => setFormCommission(e.target.value)}
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full px-6 py-2 bg-primary text-primary-foreground font-sans font-semibold rounded-block hover:bg-primary/90 transition-colors min-h-11"
              >
                Создать
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">Имя</th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Контакт
                </th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Комиссия
                </th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">Кодов</th>
                <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                  Статус
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Загрузка…
                  </td>
                </tr>
              ) : partners.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Нет партнёров
                  </td>
                </tr>
              ) : (
                partners.map((partner) => (
                  <tr key={partner.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-6 py-4 font-semibold text-foreground">{partner.name}</td>
                    <td className="px-6 py-4 text-foreground text-xs">
                      {partner.contact || '—'}
                    </td>
                    <td className="px-6 py-4 text-foreground">{partner.commissionPercent}%</td>
                    <td className="px-6 py-4 text-foreground">{partner.codesCount}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggle(partner.id, partner.isActive)}
                        className={`px-3 py-1 rounded-pill text-xs font-semibold transition-colors ${
                          partner.isActive
                            ? 'bg-success/10 text-success hover:bg-success/20'
                            : 'bg-muted text-muted-foreground hover:bg-muted/60'
                        }`}
                      >
                        {partner.isActive ? 'Активен' : 'Неактивен'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ──────────────────────────────── ОТЧЁТ ────────────────────────────────

function ReportTab({ onError }: { onError: (msg: string) => void }) {
  const [report, setReport] = useState<PayoutReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const [fromDate, setFromDate] = useState(getFirstDayOfMonth())
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])

  const load = async () => {
    setLoading(true)
    setFormError('')
    onError('')
    try {
      const from = new Date(fromDate + 'T00:00:00').toISOString()
      // «По дату» включительно — до конца выбранного дня.
      const to = new Date(toDate + 'T23:59:59.999').toISOString()
      const data = await adminGetPayoutReport(from, to)
      setReport(data)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Ошибка загрузки'
      setFormError(msg)
      onError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadReport = (e: React.FormEvent) => {
    e.preventDefault()
    load()
  }

  const downloadCsv = () => {
    if (!report) return

    const headers = [
      'Партнёр',
      'Комиссия %',
      'Заказов',
      'Оплачено',
      'Выручка ₽',
      'Скидка клиентам ₽',
      'К выплате ₽',
    ]

    const rows = report.rows.map((row) => [
      row.partnerName,
      row.commissionPercent,
      row.ordersCount,
      row.paidOrdersCount,
      formatPrice(row.revenue),
      formatPrice(row.clientDiscount),
      formatPrice(row.payout),
    ])

    rows.push([
      'ИТОГО',
      '',
      report.totals.ordersCount,
      report.totals.paidOrdersCount,
      formatPrice(report.totals.revenue),
      formatPrice(report.totals.clientDiscount),
      formatPrice(report.totals.payout),
    ])

    const csv = [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `payout-report-${fromDate}-${toDate}.csv`
    link.click()
  }

  return (
    <>
      {/* Filter */}
      <div className="bg-card border border-border rounded-block p-6 mb-8">
        <form onSubmit={handleLoadReport} className="space-y-4">
          {formError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-block">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-label font-sans text-muted-foreground mb-2">
                С даты
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-label font-sans text-muted-foreground mb-2">
                По дату
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-2 border border-border-strong rounded-block font-sans text-foreground bg-background focus:outline-ring focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="flex-1 px-6 py-2 bg-primary text-primary-foreground font-sans font-semibold rounded-block hover:bg-primary/90 transition-colors min-h-11"
              >
                Загрузить
              </button>
              {report && (
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="px-6 py-2 border border-border-strong text-foreground font-sans font-semibold rounded-block hover:bg-muted transition-colors min-h-11"
                >
                  CSV
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Table */}
      {report && (
        <div className="bg-card border border-border rounded-block overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="px-6 py-3 text-left text-muted-foreground font-semibold">
                    Партнёр
                  </th>
                  <th className="px-6 py-3 text-right text-muted-foreground font-semibold">
                    Комиссия %
                  </th>
                  <th className="px-6 py-3 text-right text-muted-foreground font-semibold">
                    Заказов
                  </th>
                  <th className="px-6 py-3 text-right text-muted-foreground font-semibold">
                    Оплачено
                  </th>
                  <th className="px-6 py-3 text-right text-muted-foreground font-semibold">
                    Выручка ₽
                  </th>
                  <th className="px-6 py-3 text-right text-muted-foreground font-semibold">
                    Скидка ₽
                  </th>
                  <th className="px-6 py-3 text-right text-muted-foreground font-semibold">
                    К выплате ₽
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      Нет данных за период
                    </td>
                  </tr>
                ) : (
                  <>
                    {report.rows.map((row) => (
                      <tr key={row.partnerId} className="border-b border-border hover:bg-muted/30">
                        <td className="px-6 py-4 font-semibold text-foreground">
                          {row.partnerName}
                        </td>
                        <td className="px-6 py-4 text-foreground text-right">
                          {row.commissionPercent}%
                        </td>
                        <td className="px-6 py-4 text-foreground text-right tabular-nums">
                          {row.ordersCount}
                        </td>
                        <td className="px-6 py-4 text-foreground text-right tabular-nums">
                          {row.paidOrdersCount}
                        </td>
                        <td className="px-6 py-4 text-foreground text-right tabular-nums">
                          {formatPrice(row.revenue)}
                        </td>
                        <td className="px-6 py-4 text-foreground text-right tabular-nums">
                          {formatPrice(row.clientDiscount)}
                        </td>
                        <td className="px-6 py-4 font-semibold text-foreground text-right tabular-nums">
                          {formatPrice(row.payout)}
                        </td>
                      </tr>
                    ))}
                    {/* Totals */}
                    <tr className="bg-muted border-t-2 border-border font-semibold">
                      <td className="px-6 py-4 text-foreground">ИТОГО</td>
                      <td className="px-6 py-4 text-foreground text-right">—</td>
                      <td className="px-6 py-4 text-foreground text-right tabular-nums">
                        {report.totals.ordersCount}
                      </td>
                      <td className="px-6 py-4 text-foreground text-right tabular-nums">
                        {report.totals.paidOrdersCount}
                      </td>
                      <td className="px-6 py-4 text-foreground text-right tabular-nums">
                        {formatPrice(report.totals.revenue)}
                      </td>
                      <td className="px-6 py-4 text-foreground text-right tabular-nums">
                        {formatPrice(report.totals.clientDiscount)}
                      </td>
                      <td className="px-6 py-4 text-foreground text-right tabular-nums">
                        {formatPrice(report.totals.payout)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-card border border-border rounded-block p-12 text-center">
          <p className="text-muted-foreground">Загрузка отчёта…</p>
        </div>
      )}
    </>
  )
}

function getFirstDayOfMonth(): string {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  return first.toISOString().split('T')[0]
}
