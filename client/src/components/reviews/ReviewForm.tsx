import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { REVIEW_PUBLICATION_CONSENT_VERSION } from '@simba/shared'
import { Review, reviewsApi } from '../../lib/api'

interface ReviewFormProps {
  productId?: string
  onCreated?: (review: Review) => void
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }
  const apiErr = err as { response?: { data?: { error?: string } } } | undefined
  return apiErr?.response?.data?.error ?? 'Не удалось отправить отзыв'
}

export default function ReviewForm({ productId, onCreated }: ReviewFormProps) {
  const { user, isLoggedIn } = useAuth()
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [name, setName] = useState(user?.name ?? '')
  const [photo, setPhoto] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [publishConsent, setPublishConsent] = useState(false)
  const [consentError, setConsentError] = useState('')
  const consentCheckboxRef = useRef<HTMLInputElement>(null)

  if (!isLoggedIn) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-card p-5 text-center">
        <p className="text-navy-700">
          Чтобы оставить отзыв, <Link to="/auth" className="text-primary-hover hover:underline font-medium">войдите</Link>
        </p>
      </div>
    )
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPhoto(true)
    try {
      const res = await reviewsApi.upload(file)
      setPhoto(res.data.url)
    } catch (err) {
      setError('Не удалось загрузить фото: ' + getErrorMessage(err))
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setConsentError('')
    setSuccess(false)

    if (!publishConsent) {
      setConsentError('Нужно согласие на публикацию отзыва с указанием имени')
      consentCheckboxRef.current?.focus()
      return
    }

    setLoading(true)

    try {
      const review = await reviewsApi.create({
        rating,
        text,
        authorName: name,
        photo,
        productId,
        publishConsentVersion: REVIEW_PUBLICATION_CONSENT_VERSION,
      })
      setRating(5)
      setText('')
      setPhoto('')
      setPublishConsent(false)
      setSuccess(true)
      onCreated?.(review.data)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-card p-6 border border-line">
      <h3 className="text-lg font-semibold text-navy-900 mb-4">Оставить отзыв</h3>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-[#C0392B] text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-success-tint border border-success rounded text-success text-sm">Спасибо! Отзыв появится после проверки</div>}

      <div className="mb-4">
        <label className="block text-sm font-medium text-navy-900 mb-2">Оценка</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <button
              key={i}
              type="button"
              onClick={() => setRating(i)}
              aria-label={`Оценка ${i} из 5`}
              aria-pressed={i <= rating}
              className={`min-w-11 min-h-11 flex items-center justify-center text-3xl transition-colors ${i <= rating ? 'text-amber-600' : 'text-navy-200 hover:text-amber-300'}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="review-name" className="block text-sm font-medium text-navy-900 mb-2">Ваше имя</label>
        <input
          id="review-name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Как вас зовут?"
          className="w-full px-4 py-2.5 border border-line rounded-xl text-sm text-navy-900 focus:outline-none focus:border-primary-soft focus:ring-2 focus:ring-primary-soft/25"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="review-text" className="block text-sm font-medium text-navy-900 mb-2">
          Ваш отзыв
        </label>
        <textarea
          id="review-text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Напишите честный отзыв..."
          rows={4}
          className="w-full px-4 py-2.5 border border-line rounded-xl text-sm text-navy-900 focus:outline-none focus:border-primary-soft focus:ring-2 focus:ring-primary-soft/25 resize-none"
        />
        <p className="mt-1 text-xs text-navy-500">{text.length} символов</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-navy-900 mb-2">Прикрепить фото (необязательно)</label>
        <div className="flex gap-3 items-center">
          <label className="px-4 py-2 bg-blue-50 text-navy-700 text-sm rounded-lg hover:bg-blue-100 cursor-pointer transition-colors font-medium">
            {uploadingPhoto ? 'Загрузка...' : 'Выбрать фото'}
            <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} hidden />
          </label>
          {photo && <span className="text-xs text-success font-medium">✓ Фото загружено</span>}
        </div>
      </div>

      <div className="mb-5">
        <label htmlFor="review-publish-consent" className="flex items-start gap-3 cursor-pointer">
          <input
            ref={consentCheckboxRef}
            id="review-publish-consent"
            type="checkbox"
            checked={publishConsent}
            onChange={(e) => {
              setPublishConsent(e.target.checked)
              if (consentError) setConsentError('')
            }}
            className="mt-0.5 w-4 h-4 shrink-0 accent-ink rounded border border-line focus:outline-none focus:ring-2 focus:ring-primary-soft/25"
            aria-invalid={!!consentError}
            aria-describedby={consentError ? 'review-publish-consent-error' : undefined}
          />
          <span className="text-sm text-navy-700 leading-snug">
            Согласен на публикацию отзыва на сайте с указанием моего имени
          </span>
        </label>
        <p className="text-xs text-navy-500 mt-1">Отзыв можно удалить в любой момент — кнопка появится рядом с ним после модерации.</p>
        {consentError && (
          <p id="review-publish-consent-error" role="alert" className="text-xs text-[#C0392B] mt-2">
            {consentError}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || !text.trim()}
        className="btn-primary press-wide w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Отправка...' : 'Отправить'}
      </button>
    </form>
  )
}
