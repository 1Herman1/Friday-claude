import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMetaTags } from '../hooks/useMetaTags'
import { reviewsApi, type Review } from '../lib/api'
import ReviewCard from '../components/reviews/ReviewCard'
import ReviewForm from '../components/reviews/ReviewForm'
import MarketplaceCard from '../components/MarketplaceCard'
import { MARKETPLACES } from '../lib/contacts'

export default function ReviewsPage() {
  useMetaTags({
    title: 'Отзывы покупателей',
    description: 'Отзывы покупателей зоомагазина Симба и оценки на Яндекс Маркете, Ozon и Авито',
  })

  const [reviews, setReviews] = useState<Review[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const loadReviews = async (p: number) => {
    setLoading(true)
    try {
      const res = await reviewsApi.list({ page: p, limit: 20 })
      setReviews(prev => p === 1 ? res.data.items : [...prev, ...res.data.items])
      setTotal(res.data.total)
      setTotalPages(res.data.totalPages)
      setPage(p)
      window.scrollTo(0, 0)
    } catch {
      setReviews([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReviews(1)
  }, [])

  const handleCreated = (review: Review) => {
    setReviews([review, ...reviews])
  }

  const handleDeleted = (id: string) => {
    setReviews(reviews.filter(r => r.id !== id))
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
      <h1 className="text-[32px] md:text-[40px] leading-tight font-bold text-navy-900 mb-6">Отзывы покупателей</h1>

      <div className="mb-10">
        <ReviewForm onCreated={handleCreated} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          <p>Отзывов пока нет</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-8">
            {reviews.map(review => (
              <ReviewCard key={review.id} review={review} onDeleted={handleDeleted} />
            ))}
          </div>

          {page < totalPages && (
            <div className="text-center mb-10">
              <button
                onClick={() => loadReviews(page + 1)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                Показать ещё
              </button>
            </div>
          )}
        </>
      )}

      <div className="mt-10 pt-10 border-t border-line">
        <h2 className="text-2xl font-bold text-navy-900 mb-4">Ещё больше отзывов — на площадках</h2>

        <div className="grid sm:grid-cols-3 gap-4">
          {MARKETPLACES.map((marketplace) => (
            <MarketplaceCard
              key={marketplace.name}
              name={marketplace.name}
              rating={marketplace.rating}
              stats={marketplace.stats}
              url={marketplace.url}
              showLink={marketplace.name === 'Яндекс Маркет' || marketplace.name === 'Ozon'}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
