import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { reviewsApi, type Review } from '../../lib/api'
import ReviewCard from '../reviews/ReviewCard'
import ReviewForm from '../reviews/ReviewForm'

interface ProductReviewsProps {
  productId: string
}

export default function ProductReviews({ productId }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  const loadReviews = async () => {
    try {
      const res = await reviewsApi.list({ limit: 5 })
      setReviews(res.data.items)
    } catch {
      setReviews([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReviews()
  }, [])

  const handleCreated = (review: Review) => {
    setReviews([review, ...reviews])
  }

  const handleDeleted = (id: string) => {
    setReviews(reviews.filter(r => r.id !== id))
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

          {reviews.length > 0 && (
            <div className="text-center">
              <Link to="/reviews" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                Все отзывы →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
