import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  adminCreateVideoReview,
  adminDeleteVideoMedia,
  adminGetVideoReview,
  adminUpdateVideoReview,
  downloadConsentDoc,
  searchPublicProducts,
  uploadConsentDoc,
  uploadVideoMedia,
  type AdminVideoReview,
  type AdminVideoReviewPatch,
  type VideoMediaSlot,
} from '@/lib/admin-api'
import { describeNotReady } from '@/components/admin/video-reviews/describe-not-ready'

type ProductHit = Awaited<ReturnType<typeof searchPublicProducts>>[number]
type Progress = Partial<Record<VideoMediaSlot | 'consentDoc', number>>

interface ReviewForm {
  authorName: string
  caption: string
  productId: string | null
  productName: string
  consentNote: string
  consentTemplateVersion: string
  consentAllowSite: boolean
  consentAllowSocial: boolean
  consentAllowAds: boolean
  consentExpiresAt: string
  consentConfirmed: boolean
  contentReviewed: boolean
  isActive: boolean
}

const EMPTY_FORM: ReviewForm = {
  authorName: '',
  caption: '',
  productId: null,
  productName: '',
  consentNote: '',
  consentTemplateVersion: '',
  consentAllowSite: false,
  consentAllowSocial: false,
  consentAllowAds: false,
  consentExpiresAt: '',
  consentConfirmed: false,
  contentReviewed: false,
  isActive: false,
}

const FIELD =
  'w-full px-4 py-3 border border-border rounded-block bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary'
const LABEL = 'block text-label font-semibold mb-2 text-foreground'
const HINT = 'text-body-sm text-muted-foreground mt-1'
const CHECK = 'flex min-h-11 items-center gap-3 cursor-pointer'
const CHECKBOX = 'w-4 h-4 rounded border-border-strong'
const SECTION = 'space-y-6 p-6 bg-card border border-border rounded-block'

function toForm(review: AdminVideoReview): ReviewForm {
  return {
    authorName: review.authorName,
    caption: review.caption ?? '',
    productId: review.product?.id ?? null,
    productName: review.product?.name ?? '',
    consentNote: review.consentNote ?? '',
    consentTemplateVersion: review.consentTemplateVersion ?? '',
    consentAllowSite: review.consentAllowSite,
    consentAllowSocial: review.consentAllowSocial,
    consentAllowAds: review.consentAllowAds,
    consentExpiresAt: review.consentExpiresAt ? review.consentExpiresAt.slice(0, 10) : '',
    consentConfirmed: review.consentConfirmed,
    contentReviewed: review.contentReviewed,
    isActive: review.isActive,
  }
}

function toPatch(form: ReviewForm): AdminVideoReviewPatch {
  return {
    authorName: form.authorName.trim(),
    caption: form.caption.trim() || null,
    productId: form.productId,
    consentNote: form.consentNote.trim() || null,
    consentTemplateVersion: form.consentTemplateVersion.trim() || null,
    consentAllowSite: form.consentAllowSite,
    consentAllowSocial: form.consentAllowSocial,
    consentAllowAds: form.consentAllowAds,
    consentExpiresAt: form.consentExpiresAt ? new Date(`${form.consentExpiresAt}T23:59:59`).toISOString() : null,
    consentConfirmed: form.consentConfirmed,
    contentReviewed: form.contentReviewed,
    isActive: form.isActive,
  }
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

function MediaField({
  inputId,
  label,
  accept,
  hint,
  ratio,
  onFile,
  children,
}: {
  inputId: string
  label: string
  accept: string
  hint: string
  ratio: number | undefined
  onFile: (file: File) => void
  children?: ReactNode
}) {
  return (
    <div className="space-y-3 p-4 border border-border rounded-block">
      <label htmlFor={inputId} className={LABEL}>
        {label}
      </label>
      {children}
      <input
        id={inputId}
        type="file"
        accept={accept}
        disabled={ratio !== undefined}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onFile(file)
        }}
        className="block w-full text-body-sm text-foreground file:mr-3 file:min-h-11 file:rounded-pill file:border file:border-primary file:bg-background file:px-4 file:text-primary"
      />
      <p className={HINT}>{hint}</p>
      {ratio !== undefined && (
        <progress aria-label={`Загрузка: ${label}`} value={Math.round(ratio * 100)} max={100} className="w-full" />
      )}
    </div>
  )
}

export function AdminVideoReviewEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id

  const [review, setReview] = useState<AdminVideoReview | null>(null)
  const [form, setForm] = useState<ReviewForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [progress, setProgress] = useState<Progress>({})

  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<ProductHit[]>([])

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const data = await adminGetVideoReview(id)
        setReview(data)
        setForm(toForm(data))
      } catch (err) {
        setError(errorMessage(err, 'Ошибка при загрузке'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  useEffect(() => {
    const query = productQuery.trim()
    if (!query) {
      setProductResults([])
      return
    }
    const timer = window.setTimeout(() => {
      searchPublicProducts(query)
        .then(setProductResults)
        .catch(() => setProductResults([]))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [productQuery])

  if (loading) {
    return (
      <div className="container-app py-12">
        <div className="text-center text-muted-foreground">Загрузка…</div>
      </div>
    )
  }

  const update = <K extends keyof ReviewForm>(key: K, value: ReviewForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Обновляет только файлы и статусы: несохранённый текст формы не трогаем
  const refreshReview = async () => {
    if (!id) return
    setReview(await adminGetVideoReview(id))
  }

  const reloadAll = async () => {
    if (!id) return
    const fresh = await adminGetVideoReview(id)
    setReview(fresh)
    setForm(toForm(fresh))
  }

  const create = async () => {
    if (!form.authorName.trim()) {
      setError('Укажите имя автора')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await adminCreateVideoReview({
        authorName: form.authorName.trim(),
        caption: form.caption.trim() || null,
        productId: form.productId,
      })
      navigate(`/admin/video-reviews/${created.id}`, { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Не удалось создать отзыв'))
      setSaving(false)
    }
  }

  const save = async () => {
    if (!id) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await adminUpdateVideoReview(id, toPatch(form))
      await reloadAll()
      setNotice('Сохранено')
    } catch (err) {
      setError(describeNotReady(err) ?? errorMessage(err, 'Не удалось сохранить'))
    } finally {
      setSaving(false)
    }
  }

  const revokeConsent = async () => {
    if (!id || !confirm('Отозвать согласие? Ролик будет снят с публикации.')) return
    setSaving(true)
    setError(null)
    try {
      await adminUpdateVideoReview(id, { consentRevoked: true })
      await reloadAll()
      setNotice('Согласие отозвано')
    } catch (err) {
      setError(errorMessage(err, 'Не удалось отозвать согласие'))
    } finally {
      setSaving(false)
    }
  }

  const uploadMedia = async (slot: VideoMediaSlot, file: File) => {
    if (!id) return
    setError(null)
    setNotice(null)
    setWarnings([])
    setProgress((prev) => ({ ...prev, [slot]: 0 }))
    try {
      const result = await uploadVideoMedia(id, slot, file, (ratio) =>
        setProgress((prev) => ({ ...prev, [slot]: ratio })),
      )
      setWarnings(result.warnings)
      setNotice('Файл загружен')
      await refreshReview()
    } catch (err) {
      setError(errorMessage(err, 'Не удалось загрузить файл'))
    } finally {
      setProgress((prev) => ({ ...prev, [slot]: undefined }))
    }
  }

  const removeMedia = async (slot: VideoMediaSlot) => {
    if (!id || !confirm('Удалить файл?')) return
    setError(null)
    try {
      await adminDeleteVideoMedia(id, slot)
      await refreshReview()
    } catch (err) {
      setError(errorMessage(err, 'Не удалось удалить файл'))
    }
  }

  const uploadDocument = async (file: File) => {
    if (!id) return
    setError(null)
    setNotice(null)
    setProgress((prev) => ({ ...prev, consentDoc: 0 }))
    try {
      await uploadConsentDoc(id, file, (ratio) => setProgress((prev) => ({ ...prev, consentDoc: ratio })))
      setNotice('Документ загружен')
      await refreshReview()
    } catch (err) {
      setError(errorMessage(err, 'Не удалось загрузить документ'))
    } finally {
      setProgress((prev) => ({ ...prev, consentDoc: undefined }))
    }
  }

  const downloadDocument = async () => {
    if (!id) return
    try {
      const blob = await downloadConsentDoc(id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `consent-${id}`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(errorMessage(err, 'Не удалось скачать документ'))
    }
  }

  const pickProduct = (product: ProductHit) => {
    update('productId', product.id)
    update('productName', product.name)
    setProductQuery('')
    setProductResults([])
  }

  return (
    <div className="container-app py-12 md:py-16">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-h2 font-heading font-bold text-foreground uppercase">
          {isNew ? 'Новый видеоотзыв' : 'Видеоотзыв'}
        </h1>
      </div>

      {error && (
        <div role="alert" className="mb-6 p-4 bg-destructive/10 text-destructive rounded-block">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="mb-6 p-4 bg-success/10 text-success rounded-block">
          {notice}
        </div>
      )}

      <div className="max-w-3xl space-y-8">
        <div className={SECTION}>
          <div>
            <label htmlFor="review-author" className={LABEL}>
              Имя автора <span className="text-destructive">*</span>
            </label>
            <input
              id="review-author"
              type="text"
              value={form.authorName}
              onChange={(e) => update('authorName', e.target.value)}
              className={FIELD}
            />
            <p className={HINT}>Ровно как в согласии: имя и город</p>
          </div>

          <div>
            <label htmlFor="review-caption" className={LABEL}>
              Подпись
            </label>
            <textarea
              id="review-caption"
              value={form.caption}
              onChange={(e) => update('caption', e.target.value)}
              rows={2}
              className={`${FIELD} resize-none`}
            />
          </div>

          <div>
            <label htmlFor="review-product-search" className={LABEL}>
              Товар
            </label>
            {form.productId ? (
              <div className="flex items-center justify-between gap-3 p-3 border border-border rounded-block">
                <span className="text-body text-foreground">{form.productName}</span>
                <button
                  type="button"
                  onClick={() => {
                    update('productId', null)
                    update('productName', '')
                  }}
                  className="min-h-11 px-4 rounded-block border border-border-strong text-foreground hover:bg-muted transition-colors"
                >
                  Убрать
                </button>
              </div>
            ) : (
              <input
                id="review-product-search"
                type="search"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Поиск товара…"
                className={FIELD}
              />
            )}
            {productResults.length > 0 && (
              <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                {productResults.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => pickProduct(product)}
                    className="w-full min-h-11 text-left p-2 rounded-block hover:bg-muted transition-colors"
                  >
                    <span className="block text-body-sm font-medium text-foreground">{product.name}</span>
                    <span className="block text-body-sm text-muted-foreground">{product.slug}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {isNew ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={create}
              disabled={saving}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-block hover:bg-primary/90 disabled:opacity-50 transition-colors font-sans font-medium"
            >
              {saving ? 'Создание…' : 'Создать и загрузить файлы'}
            </button>
            <Link to="/admin/video-reviews" className="px-6 py-3 border border-border text-foreground rounded-block hover:bg-muted transition-colors font-sans font-medium">
              Отмена
            </Link>
          </div>
        ) : (
          review && (
            <>
              <section className={SECTION} aria-labelledby="review-media-title">
                <h2 id="review-media-title" className="text-h4 font-heading font-bold text-foreground">
                  Файлы
                </h2>

                <MediaField
                  inputId="review-mp4"
                  label="Ролик MP4"
                  accept="video/mp4,.mp4"
                  hint="MP4 H.264, 720×1280, до 45 с, до 60 МБ"
                  ratio={progress.mp4}
                  onFile={(file) => uploadMedia('mp4', file)}
                >
                  {review.mp4Url ? (
                    <video src={review.mp4Url} controls playsInline preload="metadata" poster={review.posterUrl ?? undefined} className="w-full max-w-xs rounded-media" />
                  ) : (
                    <p className="text-body-sm text-muted-foreground">Не загружен</p>
                  )}
                  {review.mp4Url && (
                    <button type="button" onClick={() => removeMedia('mp4')} className="min-h-11 text-body-sm text-destructive underline underline-offset-4">
                      Удалить ролик MP4
                    </button>
                  )}
                </MediaField>

                <MediaField
                  inputId="review-webm"
                  label="Ролик WebM (необязательно)"
                  accept="video/webm,.webm"
                  hint="Меньше по весу, браузеры выбирают его первым"
                  ratio={progress.webm}
                  onFile={(file) => uploadMedia('webm', file)}
                >
                  {review.webmUrl ? (
                    <video src={review.webmUrl} controls playsInline preload="metadata" className="w-full max-w-xs rounded-media" />
                  ) : (
                    <p className="text-body-sm text-muted-foreground">Не загружен</p>
                  )}
                  {review.webmUrl && (
                    <button type="button" onClick={() => removeMedia('webm')} className="min-h-11 text-body-sm text-destructive underline underline-offset-4">
                      Удалить ролик WebM
                    </button>
                  )}
                </MediaField>

                <MediaField
                  inputId="review-poster"
                  label="Постер"
                  accept="image/webp,image/jpeg,image/png,.webp,.jpg,.jpeg,.png"
                  hint="WebP 720×1280"
                  ratio={progress.poster}
                  onFile={(file) => uploadMedia('poster', file)}
                >
                  {review.posterUrl ? (
                    <img src={review.posterUrl} alt="Постер отзыва" className="w-40 rounded-media object-cover" />
                  ) : (
                    <p className="text-body-sm text-muted-foreground">Не загружен</p>
                  )}
                  {review.posterUrl && (
                    <button type="button" onClick={() => removeMedia('poster')} className="min-h-11 text-body-sm text-destructive underline underline-offset-4">
                      Удалить постер
                    </button>
                  )}
                </MediaField>

                {warnings.length > 0 && (
                  <ul className="space-y-1 p-4 bg-accent/30 rounded-block text-body-sm text-foreground list-disc pl-8">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={SECTION} aria-labelledby="review-consent-title">
                <h2 id="review-consent-title" className="text-h4 font-heading font-bold text-foreground">
                  Согласие человека в кадре
                </h2>

                <div className="space-y-3">
                  <p className="text-body-sm text-foreground">
                    Документ: {review.hasConsentDoc ? 'загружен' : 'не загружен'}
                  </p>
                  {review.consentConfirmedBy && review.consentConfirmedAt && (
                    <p className="text-body-sm text-muted-foreground">
                      Подтвердил: {review.consentConfirmedBy.name},{' '}
                      {new Date(review.consentConfirmedAt).toLocaleDateString('ru-RU')}
                    </p>
                  )}
                  {review.consentRevokedAt && (
                    <p className="text-body-sm text-destructive">
                      Согласие отозвано {new Date(review.consentRevokedAt).toLocaleDateString('ru-RU')}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {review.hasConsentDoc && (
                      <button type="button" onClick={downloadDocument} className="min-h-11 px-4 rounded-block border border-border-strong text-foreground hover:bg-muted transition-colors">
                        Скачать документ
                      </button>
                    )}
                  </div>
                </div>

                <MediaField
                  inputId="review-consent-doc"
                  label="Документ согласия"
                  accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                  hint="PDF, JPG или PNG, до 10 МБ"
                  ratio={progress.consentDoc}
                  onFile={uploadDocument}
                />

                <div>
                  <label htmlFor="consent-template" className={LABEL}>
                    Версия шаблона согласия
                  </label>
                  <input
                    id="consent-template"
                    type="text"
                    value={form.consentTemplateVersion}
                    onChange={(e) => update('consentTemplateVersion', e.target.value)}
                    className={FIELD}
                  />
                </div>

                <fieldset className="space-y-1">
                  <legend className={LABEL}>Разрешено использовать</legend>
                  <label className={CHECK}>
                    <input type="checkbox" checked={form.consentAllowSite} onChange={(e) => update('consentAllowSite', e.target.checked)} className={CHECKBOX} />
                    <span className="text-body-sm text-foreground">Сайт</span>
                  </label>
                  <label className={CHECK}>
                    <input type="checkbox" checked={form.consentAllowSocial} onChange={(e) => update('consentAllowSocial', e.target.checked)} className={CHECKBOX} />
                    <span className="text-body-sm text-foreground">Соцсети</span>
                  </label>
                  <label className={CHECK}>
                    <input type="checkbox" checked={form.consentAllowAds} onChange={(e) => update('consentAllowAds', e.target.checked)} className={CHECKBOX} />
                    <span className="text-body-sm text-foreground">Реклама</span>
                  </label>
                </fieldset>

                <div>
                  <label htmlFor="consent-expires" className={LABEL}>
                    Срок действия
                  </label>
                  <input
                    id="consent-expires"
                    type="date"
                    value={form.consentExpiresAt}
                    onChange={(e) => update('consentExpiresAt', e.target.value)}
                    className={FIELD}
                  />
                  <p className={HINT}>Пусто — бессрочно</p>
                </div>

                <div>
                  <label htmlFor="consent-note" className={LABEL}>
                    Заметка
                  </label>
                  <textarea
                    id="consent-note"
                    value={form.consentNote}
                    onChange={(e) => update('consentNote', e.target.value)}
                    rows={2}
                    className={`${FIELD} resize-none`}
                  />
                </div>

                <label className={CHECK}>
                  <input
                    type="checkbox"
                    checked={form.consentConfirmed}
                    disabled={!review.hasConsentDoc}
                    onChange={(e) => update('consentConfirmed', e.target.checked)}
                    className={CHECKBOX}
                  />
                  <span className="text-body-sm text-foreground">Согласие подтверждено</span>
                </label>
                {!review.hasConsentDoc && <p className={HINT}>Подтвердить можно после загрузки документа</p>}

                {!review.consentRevokedAt && (
                  <button
                    type="button"
                    onClick={revokeConsent}
                    disabled={saving}
                    className="min-h-11 px-6 rounded-block bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors font-sans font-medium"
                  >
                    Отозвать согласие
                  </button>
                )}
              </section>

              <section className={SECTION} aria-labelledby="review-publish-title">
                <h2 id="review-publish-title" className="text-h4 font-heading font-bold text-foreground">
                  Публикация
                </h2>
                <label className={CHECK}>
                  <input type="checkbox" checked={form.contentReviewed} onChange={(e) => update('contentReviewed', e.target.checked)} className={CHECKBOX} />
                  <span className="text-body-sm text-foreground">Содержание проверено (нет обещаний лечения)</span>
                </label>
                <label className={CHECK}>
                  <input type="checkbox" checked={form.isActive} onChange={(e) => update('isActive', e.target.checked)} className={CHECKBOX} />
                  <span className="text-body-sm text-foreground">Опубликовать</span>
                </label>
              </section>

              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-block hover:bg-primary/90 disabled:opacity-50 transition-colors font-sans font-medium"
                >
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </button>
                <Link to="/admin/video-reviews" className="px-6 py-3 border border-border text-foreground rounded-block hover:bg-muted transition-colors font-sans font-medium">
                  К списку
                </Link>
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}
