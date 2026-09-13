import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { reviewsApi, type Review } from '../../lib/api'
import ReviewCard from '../reviews/ReviewCard'
import MarketplaceCard from '../MarketplaceCard'
import { MARKETPLACES } from '../../lib/contacts'

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadReviews = async () => {
      try {
        const res = await reviewsApi.list({ limit: 3 })
        setReviews(res.data.items)
      } catch {
        setReviews([])
      } finally {
        setLoading(false)
      }
    }
    loadReviews()
  }, [])

  // Если нет отзывов, секция не показывается
  if (loading || reviews.length === 0) {
    return null
  }

  return (
    <section id="reviews" className="scroll-mt-24 py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-navy-900">Что о нас говорят</h2>

        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {reviews.map(review => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>

        <div className="mt-8">
          <Link to="/reviews" className="btn-primary px-6">
            Все отзывы
          </Link>
        </div>

        <div className="mt-10 pt-10 border-t border-line">
          <h3 className="text-lg font-semibold text-navy-900 mb-4">Ещё больше отзывов — на площадках</h3>

          <div className="grid sm:grid-cols-3 gap-4">
            {MARKETPLACES.map(m => (
              <MarketplaceCard
                key={m.name}
                name={m.name}
                rating={m.rating}
                stats={m.stats}
                url={m.url}
                showLink={m.name === 'Яндекс Маркет' || m.name === 'Ozon'}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
