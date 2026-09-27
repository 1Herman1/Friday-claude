import { useEffect, useState, useRef } from 'react'
import { fetchApi, ApiError, fetchBlob } from '@/lib/api'
import { TelegramNotificationSettings } from '@/components/admin/TelegramNotificationSettings'

interface ProRequest {
  id: string
  userId: string
  name: string
  email: string
  phone: string
  companyName: string
  inn: string
  ogrnip?: string
  specialization: string
  comment?: string
  proStatus: 'pending' | 'approved' | 'rejected'
  proRequestedAt: string
  proReviewedAt: string | null
  proRejectReason?: string
  proCheck?: {
    lane: 'green' | 'yellow'
    registry: {
      name: string
      okvedMain: string
      state: string
      source: string
    } | null
    npd: 'self_employed' | 'not_self_employed' | 'unavailable' | 'not_checked'
    checkedAt: string
  } | null
  document?: {
    mime: string
    sizeBytes: number
    uploadedAt: string
    available: boolean
  } | null
  innDuplicates?: {
    pending: number
    approved: number
  }
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
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null)
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null)
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [documentLoading, setDocumentLoading] = useState(false)
  const [documentError, setDocumentError] = useState('')
  const imgModalRef = useRef<HTMLImageElement>(null)
  const [errorMessage, setErrorMessage] = useState('')

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
    const request = requests.find((r) => r.id === id)
    if (!request) return

    setSubmitting(id)
    setErrorMessage('')
    try {
      const body: any = { action: 'approve' }
      if (request.proStatus === 'pending') {
        body.expectedRequestedAt = request.proRequestedAt
      }
      await fetchApi(`/api/v1/admin/pro-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, proStatus: 'approved' } : r)))
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'PRO_REQUEST_CHANGED') {
          setErrorMessage('Заявка изменилась — список обновлён')
          loadRequests()
        } else {
          setErrorMessage(error.message || 'Ошибка при одобрении')
        }
      } else {
        setErrorMessage('Ошибка при одобрении')
      }
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

    const request = requests.find((r) => r.id === id)
    if (!request) return

    setSubmitting(id)
    setErrorMessage('')
    try {
      const body: any = { action: 'reject', reason }
      if (request.proStatus === 'pending') {
        body.expectedRequestedAt = request.proRequestedAt
      }
      await fetchApi(`/api/v1/admin/pro-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, proStatus: 'rejected' } : r)))
      setShowRejectModal(null)
      setRejectionReason((prev) => ({ ...prev, [id]: '' }))
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'PRO_REQUEST_CHANGED') {
          setErrorMessage('Заявка изменилась — список обновлён')
          loadRequests()
        } else if (error.code === 'PRO_INN_TAKEN') {
          setErrorMessage(error.message || 'Ошибка при отклонении')
        } else {
          setErrorMessage(error.message || 'Ошибка при отклонении')
        }
      } else {
        setErrorMessage('Ошибка при отклонении')
      }
    } finally {
      setSubmitting(null)
    }
  }

  const handleOpenDocument = async (userId: string, doc: ProRequest['document']) => {
    if (!doc || !doc.available) return

    setDocumentLoading(true)
    setDocumentError('')
    setDocumentPreviewUrl(null)
    try {
      const blob = await fetchBlob(`/api/v1/admin/pro-requests/${userId}/document`)
      const url = URL.createObjectURL(blob)

      if (doc.mime.startsWith('image/')) {
        setDocumentPreviewUrl(url)
      } else if (doc.mime === 'application/pdf') {
        // Для PDF скачиваем
        const a = document.createElement('a')
        a.href = url
        a.download = `document.pdf`
        a.click()
        URL.revokeObjectURL(url)
        return
      }
      setShowDocumentModal(true)
    } catch (error) {
      if (error instanceof ApiError) {
        setDocumentError(error.message || 'Ошибка при загрузке документа')
      } else {
        setDocumentError('Ошибка при загрузке документа')
      }
    } finally {
      setDocumentLoading(false)
    }
  }

  const closeDocumentModal = () => {
    if (documentPreviewUrl && documentPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(documentPreviewUrl)
    }
    setDocumentPreviewUrl(null)
    setShowDocumentModal(false)
  }

  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showDocumentModal) {
        closeDocumentModal()
      }
    }
    if (showDocumentModal) {
      document.addEventListener('keydown', handleEscKey)
    }
    return () => {
      document.removeEventListener('keydown', handleEscKey)
    }
  }, [showDocumentModal])

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

      {/* Telegram Notifications */}
      <TelegramNotificationSettings />

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

      {errorMessage && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-block p-4">
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      )}

      {/* Requests List */}
      {loading ? (
        <div className="text-center text-muted-foreground py-12">Загрузка…</div>
      ) : requests.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">Нет заявок</div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-card rounded-block border border-border overflow-hidden">
              {/* Summary Row - Always Visible */}
              <button
                onClick={() => setExpandedRequest(expandedRequest === req.id ? null : req.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex-1 flex gap-4 items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{req.companyName}</p>
                    <p className="text-xs text-muted-foreground mt-1">{req.name}</p>
                    <p className="text-xs text-muted-foreground">{req.email} • {req.phone}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-mono text-foreground">{req.inn}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(req.proRequestedAt)}</p>
                  </div>
                  <div className="flex-shrink-0">{getStatusBadge(req.proStatus)}</div>
                </div>
                <span className="text-muted-foreground ml-4 flex-shrink-0">
                  {expandedRequest === req.id ? '▲' : '▼'}
                </span>
              </button>

              {/* Expanded Details */}
              {expandedRequest === req.id && (
                <div className="border-t border-border px-6 py-4 bg-muted/30 space-y-6">
                  {/* Lane Badge */}
                  {req.proCheck?.lane && (
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-2">Приоритет</p>
                      <div className={`inline-block px-3 py-1 rounded-pill text-xs font-semibold ${
                        req.proCheck.lane === 'green'
                          ? 'bg-success/20 text-success'
                          : 'bg-urgency/20 text-urgency'
                      }`}>
                        {req.proCheck.lane === 'green'
                          ? '✓ Найден в реестре МСП'
                          : 'Нет в реестре — проверить вручную'}
                      </div>
                    </div>
                  )}

                  {/* Registry Data */}
                  {req.proCheck?.registry && (
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-3">Данные реестра</p>
                      <div className="bg-card rounded-block p-4 space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Название / ФИО</p>
                          <p className="text-sm text-foreground font-semibold">{req.proCheck.registry.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">ОКВЭД</p>
                          <p className="text-sm text-foreground font-mono">{req.proCheck.registry.okvedMain}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Статус</p>
                          <p className="text-sm text-foreground">{req.proCheck.registry.state}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* NPD Info (for 12-digit INN) */}
                  {req.inn.replace(/\D/g, '').length === 12 && req.proCheck?.npd && (
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-2">Статус НПД</p>
                      <p className="text-sm text-foreground">
                        {req.proCheck.npd === 'self_employed'
                          ? 'Самозанятый'
                          : req.proCheck.npd === 'not_self_employed'
                          ? 'Не самозанятый'
                          : req.proCheck.npd === 'unavailable'
                          ? 'Сервис ФНС не ответил'
                          : 'Не проверено'}
                      </p>
                    </div>
                  )}

                  {/* INN Duplicates Warning */}
                  {req.innDuplicates && (req.innDuplicates.pending > 0 || req.innDuplicates.approved > 0) && (
                    <div className="bg-urgency/10 border border-urgency/30 rounded-block p-4">
                      <div className="flex gap-2 items-start">
                        <span className="text-urgency font-bold mt-1">⚠</span>
                        <div>
                          <p className="text-sm text-foreground font-semibold">Дубликаты ИНН</p>
                          <p className="text-sm text-foreground mt-1">
                            Этот ИНН заявлен ещё в {req.innDuplicates.pending} заявках, одобрен у {req.innDuplicates.approved} аккаунтов.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Document */}
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">Документ</p>
                    {req.document?.available ? (
                      <button
                        onClick={() => handleOpenDocument(req.userId, req.document)}
                        disabled={documentLoading}
                        className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-pill hover:opacity-90 disabled:opacity-50 min-h-11"
                      >
                        {documentLoading ? 'Загрузка…' : 'Открыть документ'}
                      </button>
                    ) : (
                      <p className="text-sm text-muted-foreground">Документ удалён по сроку хранения</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Сверьте имя на документе с именем из реестра.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t border-border">
                    {req.proStatus === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={submitting === req.id}
                          className="flex-1 px-4 py-2 bg-success text-white font-semibold rounded-pill hover:opacity-90 disabled:opacity-50 min-h-11"
                        >
                          {submitting === req.id ? 'Обработка…' : 'Одобрить'}
                        </button>
                        <button
                          onClick={() => setShowRejectModal(req.id)}
                          disabled={submitting === req.id}
                          className="flex-1 px-4 py-2 bg-destructive text-white font-semibold rounded-pill hover:opacity-90 disabled:opacity-50 min-h-11"
                        >
                          Отклонить
                        </button>
                      </>
                    )}
                    {req.proStatus === 'rejected' && req.proRejectReason && (
                      <details className="flex-1">
                        <summary className="cursor-pointer px-4 py-2 text-sm text-destructive font-semibold hover:bg-destructive/10 rounded-pill">
                          Показать причину отклонения
                        </summary>
                        <p className="mt-3 text-sm text-foreground bg-muted p-3 rounded-block border border-border">
                          {req.proRejectReason}
                        </p>
                      </details>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
                className="flex-1 px-4 py-2 border border-border rounded-pill hover:bg-muted min-h-11"
              >
                Отмена
              </button>
              <button
                onClick={() => handleReject(showRejectModal)}
                disabled={submitting === showRejectModal}
                className="flex-1 px-4 py-2 bg-destructive text-white rounded-pill hover:opacity-90 disabled:opacity-50 min-h-11"
              >
                Отклонить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Modal */}
      {showDocumentModal && documentPreviewUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeDocumentModal}>
          <div className="bg-card rounded-block max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-lg font-semibold">Документ заявителя</h3>
              <button
                onClick={closeDocumentModal}
                className="text-muted-foreground hover:text-foreground font-semibold"
              >
                ✕
              </button>
            </div>
            <div className="p-6 flex items-center justify-center bg-muted">
              <img
                ref={imgModalRef}
                src={documentPreviewUrl}
                alt="Документ заявителя"
                className="max-w-full max-h-[calc(90vh-200px)] object-contain"
              />
            </div>
            <div className="flex justify-end gap-2 p-6 border-t border-border">
              <button
                onClick={closeDocumentModal}
                className="px-4 py-2 border border-border rounded-pill hover:bg-muted min-h-11"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {documentError && (
        <div className="fixed bottom-4 right-4 bg-destructive/10 border border-destructive/30 rounded-block p-4 max-w-md">
          <p className="text-sm text-destructive">{documentError}</p>
        </div>
      )}
    </div>
  )
}
