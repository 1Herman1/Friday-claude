import { useEffect, useRef, useState } from 'react'
import { reviewsApi, type Review } from '../../lib/api'
import ReviewCard from '../reviews/ReviewCard'
import ReviewForm from '../reviews/ReviewForm'

interface ProductReviewsProps {
  productId: string
}

export default function ProductReviews({ productId }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  // Ответ для уже сменившегося товара выбрасываем — иначе «Показать ещё» старого
  // товара доклеит его отзывы к новому.
  const currentProductId = useRef(productId)
  currentProductId.current = productId

  const loadReviews = async (p: number = 1) => {
    if (p === 1) setLoading(true)
    try {
      const res = await reviewsApi.list({ productId, limit: 5, page: p })
      if (currentProductId.current !== productId) return
      if (p === 1) {
        setReviews(res.data.items)
      } else {
        setReviews(prev => [...prev, ...res.data.items])
      }
      setTotal(res.data.total)
      setPage(p)
    } catch {
      setReviews([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReviews(1)
  }, [productId])

  const handleCreated = (review: Review) => {
    setReviews(prev => [review, ...prev])
    setTotal(t => t + 1)
  }

  const handleDeleted = (id: string) => {
    setReviews(prev => prev.filter(r => r.id !== id))
  }

  if (loading) return null

  return (
    <div className="space-y-6">
      <ReviewForm productId={productId} onCreated={handleCreated} />

      {reviews.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          <p>Отзывов пока нет — станьте первым</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {reviews.map(review => (
              <ReviewCard key={review.id} review={review} onDeleted={handleDeleted} />
            ))}
          </div>

          {reviews.length < total && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => loadReviews(page + 1)}
                className="btn-outline px-6 rounded-pill text-sm font-medium"
              >
                Показать ещё
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
