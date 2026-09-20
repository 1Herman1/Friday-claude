import { useEffect, useState } from 'react'
import { fetchApi } from '@/lib/api'

interface ProRequest {
  id: string
  name: string
  email: string
  phone: string
  companyName: string
  inn: string
  specialization: string
  proStatus: 'pending' | 'approved' | 'rejected'
  proRequestedAt: string
  proReviewedAt: string | null
  proRejectReason?: string
}

interface ProRequestsResponse {
  items: ProRequest[]
  total: number
  skip: number
  limit: number
}

export function AdminProRequestsPage() {
  const [requests, setRequests] = useState<ProRequest[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [status, setStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState<{ [key: string]: string }>({})
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)

  const limit = 20

  useEffect(() => {
    loadRequests()
  }, [status, skip])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams({
        status: status === 'all' ? 'all' : status,
        skip: skip.toString(),
        limit: limit.toString(),
      })
      const data = await fetchApi<ProRequestsResponse>(`/api/v1/admin/pro-requests?${query}`)
      setRequests(data.items)
      setTotal(data.total)
    } catch (error) {
      console.error('Failed to load pro requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    setSubmitting(id)
    try {
      await fetchApi(`/api/v1/admin/pro-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'approve' }),
      })
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, proStatus: 'approved' } : r)))
    } catch (error) {
      console.error('Failed to approve request:', error)
    } finally {
      setSubmitting(null)
    }
  }

  const handleReject = async (id: string) => {
    const reason = rejectionReason[id]
    if (!reason.trim()) {
      alert('Укажите причину отклонения')
      return
    }

    setSubmitting(id)
    try {
      await fetchApi(`/api/v1/admin/pro-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reject', reason }),
      })
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, proStatus: 'rejected' } : r)))
      setShowRejectModal(null)
      setRejectionReason((prev) => ({ ...prev, [id]: '' }))
    } catch (error) {
      console.error('Failed to reject request:', error)
    } finally {
      setSubmitting(null)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const styles: { [key: string]: string } = {
      pending: 'bg-urgency text-white',
      approved: 'bg-success text-white',
      rejected: 'bg-destructive text-white',
    }
    const labels: { [key: string]: string } = {
      pending: 'На проверке',
      approved: 'Одобрено',
      rejected: 'Отклонено',
    }
    return (
      <span className={`px-3 py-1 rounded-pill text-xs font-semibold ${styles[status] || ''}`}>
        {labels[status] || status}
      </span>
    )
  }

  const pages = Math.ceil(total / limit)
  const currentPage = Math.floor(skip / limit) + 1

  return (
    <div className="container-app py-12 md:py-16 space-y-6">
      <div>
        <h1 className="text-h2 font-heading font-bold mb-2">Заявки специалистов</h1>
        <p className="text-muted-foreground">Всего заявок: {total}</p>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {['all', 'pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s as any)
              setSkip(0)
            }}
            className={`px-4 py-2 rounded-pill text-sm font-semibold transition-colors ${
              status === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            {{
              all: 'Все',
              pending: 'На проверке',
              approved: 'Одобрено',
              rejected: 'Отклонено',
            }[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-block overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Компания</th>
                <th className="px-4 py-3 text-left font-semibold">Контакт</th>
                <th className="px-4 py-3 text-left font-semibold">ИНН</th>
                <th className="px-4 py-3 text-left font-semibold">Специализация</th>
                <th className="px-4 py-3 text-left font-semibold">Статус</th>
                <th className="px-4 py-3 text-left font-semibold">Дата</th>
                <th className="px-4 py-3 text-left font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Загрузка…
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Нет заявок
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-foreground">{req.companyName}</p>
                        <p className="text-xs text-muted-foreground">{req.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <p>{req.email}</p>
                        <p className="text-muted-foreground">{req.phone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{req.inn}</td>
                    <td className="px-4 py-3 text-sm">{req.specialization}</td>
                    <td className="px-4 py-3">{getStatusBadge(req.proStatus)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(req.proRequestedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {req.proStatus === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(req.id)}
                              disabled={submitting === req.id}
                              className="px-3 py-1 bg-success text-white text-xs font-semibold rounded-pill hover:opacity-90 disabled:opacity-50"
                            >
                              Одобрить
                            </button>
                            <button
                              onClick={() => setShowRejectModal(req.id)}
                              disabled={submitting === req.id}
                              className="px-3 py-1 bg-destructive text-white text-xs font-semibold rounded-pill hover:opacity-90 disabled:opacity-50"
                            >
                              Отклонить
                            </button>
                          </>
                        )}
                        {req.proStatus === 'rejected' && req.proRejectReason && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-destructive font-semibold">
                              Причина
                            </summary>
                            <p className="mt-2 text-muted-foreground bg-muted p-2 rounded">
                              {req.proRejectReason}
                            </p>
                          </details>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setSkip(Math.max(0, skip - limit))}
            disabled={skip === 0}
            className="px-4 py-2 rounded-block border border-border hover:bg-muted disabled:opacity-50"
          >
            ← Назад
          </button>
          <span className="text-sm text-muted-foreground">
            Страница {currentPage} из {pages}
          </span>
          <button
            onClick={() => setSkip(skip + limit)}
            disabled={currentPage >= pages}
            className="px-4 py-2 rounded-block border border-border hover:bg-muted disabled:opacity-50"
          >
            Далее →
          </button>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-block p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Отклонить заявку</h3>
            <textarea
              value={rejectionReason[showRejectModal] || ''}
              onChange={(e) =>
                setRejectionReason((prev) => ({
                  ...prev,
                  [showRejectModal]: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring mb-4 min-h-[100px]"
              placeholder="Укажите причину отклонения"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowRejectModal(null)}
                className="flex-1 px-4 py-2 border border-border rounded-pill hover:bg-muted"
              >
                Отмена
              </button>
              <button
                onClick={() => handleReject(showRejectModal)}
                disabled={submitting === showRejectModal}
                className="flex-1 px-4 py-2 bg-destructive text-white rounded-pill hover:opacity-90 disabled:opacity-50"
              >
                Отклонить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
