import { Link } from 'react-router-dom'
import MarketplaceCard from '../MarketplaceCard'
import { MARKETPLACES } from '../../lib/contacts'

export default function ReviewsSection() {
  return (
    <section id="reviews" className="scroll-mt-24 py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-navy-900">Что о нас говорят</h2>
        <p className="mt-2 text-navy-500 max-w-prose leading-relaxed">
          Мы не публикуем отзывы у себя на сайте вручную — их невозможно проверить. Читайте нас там, где отзывы оставляют реальные покупатели после реальных заказов.
        </p>

        {/* Три карточки площадок */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          {MARKETPLACES.map((m) => (
            <MarketplaceCard
              key={m.name}
              name={m.name}
              rating={m.rating}
              stats={m.stats}
              url={m.url}
              showLink={m.showLink}
            />
          ))}
        </div>

        <div className="mt-8">
          <Link
            to="/reviews"
            className="btn-primary px-6"
          >
            Читать отзывы
          </Link>
        </div>

        {/* Нотайс-бокс — тёплый amber-50 на холодной blue-50 полосе */}
        <div className="mt-6 bg-amber-50 border border-amber-100 rounded-card p-5">
          <p className="text-navy-500 leading-relaxed">
            Заказывая на сайте, вы получаете бонусы и цены без наценки площадок.
          </p>
        </div>
      </div>
    </section>
  )
}
