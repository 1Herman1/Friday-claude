import { useEffect, useState } from 'react'
import { fetchApi, ApiError } from '@/lib/api'

interface Consultation {
  id: string
  name: string
  phone: string
  email: string | null
  channel: string | null
  message: string | null
  skinType: string | null
  concern: string | null
  source: string | null
  status: 'new' | 'contacted' | 'scheduled' | 'done' | 'cancelled'
  adminNote: string | null
  createdAt: string
  updatedAt: string
}

interface ConsultationsResponse {
  items: Consultation[]
  total: number
  skip: number
  limit: number
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  contacted: 'Связались',
  scheduled: 'Назначена',
  done: 'Завершена',
  cancelled: 'Отменена',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-urgency text-white',
  contacted: 'bg-accent text-foreground',
  scheduled: 'bg-info text-white',
  done: 'bg-success text-white',
  cancelled: 'bg-muted text-muted-foreground',
}

const CHANNEL_LABELS: Record<string, string> = {
  phone: 'Телефон',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
}

const SOURCE_LABELS: Record<string, string> = {
  tile: 'Плитка',
  quiz: 'Квиз',
  contacts: 'Контакты',
}

export function AdminConsultationsPage() {
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [status, setStatus] = useState<'all' | 'new' | 'contacted' | 'scheduled' | 'done' | 'cancelled'>('new')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingStatus, setEditingStatus] = useState<{ [key: string]: string }>({})
  const [editingNote, setEditingNote] = useState<{ [key: string]: string }>({})
  const [errorMessage, setErrorMessage] = useState('')

  const limit = 20

  useEffect(() => {
    loadConsultations()
  }, [status, skip])

  const loadConsultations = async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams({
        status: status === 'all' ? 'all' : status,
        skip: skip.toString(),
        limit: limit.toString(),
      })
      const data = await fetchApi<ConsultationsResponse>(`/api/v1/admin/consultations?${query}`)
      setConsultations(data.items)
      setTotal(data.total)
    } catch (error) {
      console.error('Failed to load consultations:', error)
      setErrorMessage('Ошибка при загрузке заявок')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (id: string) => {
    const newStatus = editingStatus[id]
    const note = editingNote[id] || ''

    if (!newStatus) return

    setSubmitting(id)
    setErrorMessage('')
    try {
      await fetchApi(`/api/v1/admin/consultations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          adminNote: note || undefined,
        }),
      })
      setConsultations((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, status: newStatus as Consultation['status'], adminNote: note || null }
            : c
        )
      )
      setEditingStatus((prev) => ({ ...prev, [id]: '' }))
      setExpandedId(null)
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message || 'Ошибка при сохранении')
      } else {
        setErrorMessage('Ошибка при сохранении')
      }
    } finally {
      setSubmitting(null)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const pages = Math.ceil(total / limit)
  const currentPage = Math.floor(skip / limit) + 1

  return (
    <div className="container-app py-12 md:py-16 space-y-6">
      <div>
        <h1 className="text-h2 font-heading font-bold mb-6">Заявки на консультацию</h1>

        {errorMessage && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-block">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </div>
        )}

        {/* Status Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(['new', 'contacted', 'scheduled', 'done', 'cancelled', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s)
                setSkip(0)
              }}
              className={`px-4 py-2 rounded-pill text-sm font-semibold transition-colors ${
                status === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-border'
              }`}
            >
              {s === 'all' ? 'Все' : STATUS_LABELS[s] || s}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-border rounded-block bg-card">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Загрузка…</div>
          ) : consultations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Нет заявок</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Имя</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Телефон</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Канал</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Статус</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Дата</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Действия</th>
                </tr>
              </thead>
              <tbody>
                {consultations.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-muted/50">
                    <td className="px-6 py-4 text-sm text-foreground">{c.name}</td>
                    <td className="px-6 py-4 text-sm text-foreground font-mono">{c.phone}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {c.channel ? CHANNEL_LABELS[c.channel] || c.channel : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-pill text-xs font-semibold ${STATUS_COLORS[c.status] || ''}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(c.createdAt)}</td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                        className="text-primary hover:underline font-semibold"
                      >
                        {expandedId === c.id ? 'Свернуть' : 'Подробнее'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Expanded Row Details */}
        {expandedId && (
          <div className="mt-6 p-6 bg-muted rounded-block border border-border space-y-4">
            {(() => {
              const c = consultations.find((x) => x.id === expandedId)
              if (!c) return null
              return (
                <>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">Email</label>
                      <p className="text-sm text-foreground">{c.email || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">Тип кожи</label>
                      <p className="text-sm text-foreground">{c.skinType || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">Задача</label>
                      <p className="text-sm text-foreground">{c.concern || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">Источник</label>
                      <p className="text-sm text-foreground">{c.source ? SOURCE_LABELS[c.source] || c.source : '—'}</p>
                    </div>
                  </div>

                  {c.message && (
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">Сообщение</label>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">{c.message}</p>
                    </div>
                  )}

                  <div className="border-t border-border pt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">Новый статус</label>
                      <select
                        value={editingStatus[c.id] || c.status}
                        onChange={(e) => setEditingStatus((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-block bg-card text-sm text-foreground"
                      >
                        <option value={c.status}>— Не менять —</option>
                        {(['new', 'contacted', 'scheduled', 'done', 'cancelled'] as const).map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">Заметка (до 1000 символов)</label>
                      <textarea
                        value={editingNote[c.id] ?? c.adminNote ?? ''}
                        onChange={(e) => setEditingNote((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-border rounded-block bg-card text-sm text-foreground"
                        maxLength={1000}
                      />
                    </div>

                    <button
                      onClick={() => handleStatusChange(c.id)}
                      disabled={submitting === c.id || !editingStatus[c.id]}
                      className="px-6 py-2 bg-primary text-primary-foreground rounded-pill text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {submitting === c.id ? 'Сохраняю…' : 'Сохранить'}
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex justify-between items-center mt-6">
            <div className="text-sm text-muted-foreground">
              Страница {currentPage} из {pages} ({total} заявок)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSkip(Math.max(0, skip - limit))}
                disabled={skip === 0}
                className="px-4 py-2 border border-border rounded-block text-sm font-semibold hover:bg-muted disabled:opacity-50"
              >
                ← Назад
              </button>
              <button
                onClick={() => setSkip(skip + limit)}
                disabled={currentPage >= pages}
                className="px-4 py-2 border border-border rounded-block text-sm font-semibold hover:bg-muted disabled:opacity-50"
              >
                Вперёд →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
