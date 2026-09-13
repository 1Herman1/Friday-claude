import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
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

  if (!isLoggedIn) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-card p-5 text-center">
        <p className="text-gray-700">
          Чтобы оставить отзыв, <Link to="/auth" className="text-blue-600 hover:underline font-medium">войдите</Link>
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
    setSuccess(false)
    setLoading(true)

    try {
      const review = await reviewsApi.create({
        rating,
        text,
        authorName: name,
        photo,
        productId,
      })
      setRating(5)
      setText('')
      setPhoto('')
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
    <form onSubmit={handleSubmit} className="bg-white rounded-card p-6 border border-gray-100">
      <h3 className="text-lg font-semibold text-navy-900 mb-4">Оставить отзыв</h3>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">Спасибо! Отзыв появится после проверки</div>}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Оценка</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <button
              key={i}
              type="button"
              onClick={() => setRating(i)}
              aria-label={`Оценка ${i} из 5`}
              aria-pressed={i <= rating}
              className={`text-3xl transition-colors ${i <= rating ? 'text-amber-400' : 'text-gray-300 hover:text-amber-200'}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Ваше имя</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Как вас зовут?"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="review-text" className="block text-sm font-medium text-gray-700 mb-2">
          Ваш отзыв
        </label>
        <textarea
          id="review-text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Напишите честный отзыв..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 resize-none"
        />
        <p className="mt-1 text-xs text-gray-500">{text.length} символов</p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Прикрепить фото (необязательно)</label>
        <div className="flex gap-3 items-center">
          <label className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 cursor-pointer transition-colors">
            {uploadingPhoto ? 'Загрузка...' : 'Выбрать фото'}
            <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} hidden />
          </label>
          {photo && <span className="text-xs text-green-600">✓ Фото загружено</span>}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !text.trim()}
        className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
      >
        {loading ? 'Отправка...' : 'Отправить'}
      </button>
    </form>
  )
}
