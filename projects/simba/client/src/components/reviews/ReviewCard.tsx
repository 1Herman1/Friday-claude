import { Review, reviewsApi } from '../../lib/api'

interface ReviewCardProps {
  review: Review
  onDeleted?: (id: string) => void
}

export default function ReviewCard({ review, onDeleted }: ReviewCardProps) {
  const handleDelete = async () => {
    if (!confirm('Удалить отзыв?')) return
    try {
      await reviewsApi.remove(review.id)
      onDeleted?.(review.id)
    } catch {
      alert('Не удалось удалить отзыв')
    }
  }

  return (
    <div className="bg-white rounded-card p-5 border border-gray-100">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="font-medium text-navy-900">{review.authorName}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(i => (
                <span key={i} className={i <= review.rating ? 'text-amber-500' : 'text-gray-300'}>
                  ★
                </span>
              ))}
            </div>
            <span className="text-xs text-gray-500">
              {new Date(review.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
        {review.mine && (
          <button
            onClick={handleDelete}
            className="ml-3 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            Удалить
          </button>
        )}
      </div>

      {review.status === 'pending' && review.mine && (
        <div className="mb-3 px-2 py-1 bg-yellow-50 text-yellow-700 text-xs rounded inline-block">На модерации</div>
      )}
      {review.status === 'rejected' && review.mine && (
        <div className="mb-3 px-2 py-1 bg-red-50 text-red-700 text-xs rounded inline-block">Отклонён</div>
      )}

      <p className="text-gray-700 text-sm whitespace-pre-line">{review.text}</p>

      {review.photo && <img src={review.photo} alt="" className="mt-3 rounded-xl max-h-64 object-cover w-full" />}
    </div>
  )
}
