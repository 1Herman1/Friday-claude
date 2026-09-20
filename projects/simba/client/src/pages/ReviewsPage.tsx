import { Link } from 'react-router-dom'
import { useMetaTags } from '../hooks/useMetaTags'
import MarketplaceCard from '../components/MarketplaceCard'
import { CONTACTS, MARKETPLACES } from '../lib/contacts'
import { TelegramIcon } from '../components/icons'

export default function ReviewsPage() {
  useMetaTags({
    title: 'Отзывы о зоомагазине Симба',
    description:
      'Мы не публикуем отзывы на сайте вручную — читайте нас на Яндекс Маркете, Ozon и Авито, где отзывы оставляют реальные покупатели.',
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
      <h1 className="text-[32px] md:text-[40px] leading-tight font-bold text-navy-900 mb-3">Что о нас говорят</h1>

      <p className="text-navy-500 max-w-prose mb-10 leading-relaxed">
        Мы не публикуем отзывы у себя на сайте вручную — их невозможно проверить. Вместо этого читайте нас там, где отзывы
        оставляют реальные покупатели после реальных заказов.
      </p>

      <h2 className="text-2xl font-bold text-navy-900 mb-4">Где нас читают</h2>

      <div className="grid md:grid-cols-3 gap-4 mb-10">
        {MARKETPLACES.map((marketplace) => (
          <MarketplaceCard
            key={marketplace.name}
            name={marketplace.name}
            rating={marketplace.rating}
            stats={marketplace.stats}
            url={marketplace.url}
            showLink={marketplace.showLink}
          />
        ))}
      </div>

      {/* Info block */}
      <div className="bg-white border border-line rounded-card p-5">
        <p className="text-navy-500 leading-relaxed">
          Заказывая на сайте, вы получаете{' '}
          <Link to="/bonuses" className="font-medium text-navy-700 hover:text-primary-hover transition-colors duration-100 ease">
            бонусы
          </Link>
          {' '}и цены без наценки площадок.
        </p>
      </div>

      <div className="mt-10 pt-6 border-t border-line flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-navy-500">Остались вопросы — спросите нас напрямую.</p>
        <a
          href={CONTACTS.telegram}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary px-6 gap-2 whitespace-nowrap"
        >
          <TelegramIcon />
          Написать в Telegram
        </a>
      </div>
    </div>
  )
}
