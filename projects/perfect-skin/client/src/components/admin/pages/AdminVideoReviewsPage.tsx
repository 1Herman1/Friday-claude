import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  adminListVideoReviews,
  adminReorderVideoReviews,
  adminUpdateVideoReview,
  type AdminVideoReview,
} from '@/lib/admin-api'
import { IconCheck, IconChevronDown } from '@/components/icons'
import { describeNotReady } from '@/components/admin/video-reviews/describe-not-ready'

const CHIPS: { key: 'consentConfirmed' | 'hasConsentDoc' | 'contentReviewed' | 'isActive'; label: string }[] = [
  { key: 'consentConfirmed', label: 'Согласие' },
  { key: 'hasConsentDoc', label: 'Документ' },
  { key: 'contentReviewed', label: 'Проверено' },
  { key: 'isActive', label: 'Опубликовано' },
]

const ICON_BUTTON =
  'inline-flex size-11 items-center justify-center rounded-pill border border-border-strong text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

export function AdminVideoReviewsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<AdminVideoReview[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      const result = await adminListVideoReviews()
      setItems(result.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const togglePublish = async (item: AdminVideoReview) => {
    setBusyId(item.id)
    setError(null)
    try {
      await adminUpdateVideoReview(item.id, { isActive: !item.isActive })
      await load()
    } catch (err) {
      setError(describeNotReady(err) ?? (err instanceof Error ? err.message : 'Не удалось изменить публикацию'))
    } finally {
      setBusyId(null)
    }
  }

  const move = async (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    setItems(next)
    try {
      await adminReorderVideoReviews(next.map((item) => item.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить порядок')
      await load()
    }
  }

  if (loading) {
    return (
      <div className="container-app py-12">
        <div className="text-center text-muted-foreground">Загрузка…</div>
      </div>
    )
  }

  return (
    <div className="container-app py-12 md:py-16">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-h2 font-heading font-bold text-foreground uppercase">Видеоотзывы</h1>
        <button
          onClick={() => navigate('/admin/video-reviews/new')}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-block hover:bg-primary/90 transition-colors font-sans font-medium"
        >
          Новый отзыв
        </button>
      </div>

      {error && <div role="alert" className="mb-6 p-4 bg-destructive/10 text-destructive rounded-block">{error}</div>}

      {items.length === 0 ? (
        <div className="bg-card border border-border rounded-block p-12 text-center">
          <p className="text-muted-foreground">Видеоотзывов нет</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-block overflow-x-auto">
          <table className="w-full min-w-[56rem]">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {['Постер', 'Автор', 'Товар', 'Статусы', 'Публикация', 'Порядок'].map((title) => (
                  <th key={title} className="px-6 py-4 text-left text-label font-semibold text-foreground uppercase">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="px-6 py-4">
                    {item.posterUrl ? (
                      <img src={item.posterUrl} alt="" className="h-20 w-11 rounded-media object-cover" />
                    ) : (
                      <div className="h-20 w-11 rounded-media bg-muted" />
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Link to={`/admin/video-reviews/${item.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                      {item.authorName}
                    </Link>
                    {item.caption && <p className="text-body-sm text-muted-foreground line-clamp-1">{item.caption}</p>}
                  </td>
                  <td className="px-6 py-4 text-body-sm text-foreground">{item.product?.name ?? '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {CHIPS.map((chip) => {
                        const ok = item[chip.key]
                        return (
                          <span
                            key={chip.key}
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-label font-semibold ${
                              ok ? 'bg-success/20 text-success' : 'bg-muted/50 text-muted-foreground'
                            }`}
                          >
                            {ok && <IconCheck size={12} />}
                            {chip.label}: {ok ? 'да' : 'нет'}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <label className="inline-flex min-h-11 items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.isActive}
                        disabled={busyId === item.id}
                        onChange={() => togglePublish(item)}
                        className="w-4 h-4 rounded border-border-strong"
                      />
                      <span className="text-body-sm text-foreground">{item.isActive ? 'Показан' : 'Скрыт'}</span>
                    </label>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        aria-label={`Выше: ${item.authorName}`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        className={ICON_BUTTON}
                      >
                        <IconChevronDown size={20} className="rotate-180" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Ниже: ${item.authorName}`}
                        disabled={index === items.length - 1}
                        onClick={() => move(index, 1)}
                        className={ICON_BUTTON}
                      >
                        <IconChevronDown size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
