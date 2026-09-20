import { Link } from 'react-router-dom'
import { useMetaTags } from '../hooks/useMetaTags'
import { SUBSCRIPTION_DISCOUNT_PERCENT } from '@simba/shared'

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function SubscriptionPage() {
  useMetaTags({
    title: `Подписка на корм со скидкой ${SUBSCRIPTION_DISCOUNT_PERCENT} % — Зоомагазин Симба`,
    description:
      'Скидка на корм и напоминание о покупке каждый месяц. Без автосписаний, без привязки к карте.',
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
      <h1 className="text-[32px] md:text-[40px] leading-tight font-bold text-navy-900 mb-3">Подписка на корм</h1>
      <p className="text-lg text-navy-500 mb-10 max-w-prose">
        Скидка {SUBSCRIPTION_DISCOUNT_PERCENT} % на выбранный корм и напоминание, когда пора пополнить запас. Без автосписаний.
      </p>

      {/* Как это работает */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-navy-900 mb-6">Как это работает</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Шаг 1 */}
          <div className="bg-white rounded-card border border-line p-5">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-ink text-white font-bold text-sm mb-3">1</div>
            <h3 className="font-bold text-navy-900 mb-2">Выберите подписку</h3>
            <p className="text-sm text-navy-500 leading-relaxed">
              На странице товара выберите «Подписка −{SUBSCRIPTION_DISCOUNT_PERCENT} %» и интервал: 2, 4, 6 или 8 недель.
            </p>
          </div>

          {/* Шаг 2 */}
          <div className="bg-white rounded-card border border-line p-5">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-ink text-white font-bold text-sm mb-3">2</div>
            <h3 className="font-bold text-navy-900 mb-2">Подтвердим заказ</h3>
            <p className="text-sm text-navy-500 leading-relaxed">
              Перед каждой доставкой мы свяжемся и подтвердим заказ. Состав и адрес можно изменить в любой момент.
            </p>
          </div>

          {/* Шаг 3 */}
          <div className="bg-white rounded-card border border-line p-5">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-ink text-white font-bold text-sm mb-3">3</div>
            <h3 className="font-bold text-navy-900 mb-2">Оплата и доставка</h3>
            <p className="text-sm text-navy-500 leading-relaxed">
              Оплата при получении, списаний с карты нет. Доставляем как обычный заказ.
            </p>
          </div>
        </div>
      </section>

      {/* Что можно менять */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-navy-900 mb-4">Что можно менять</h2>
        <div className="bg-primary-tint rounded-card p-5">
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CheckIcon className="text-amber-600 flex-shrink-0 mt-0.5" />
              <span className="text-navy-500">Интервал доставки — с 2 до 8 недель в любой момент</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckIcon className="text-amber-600 flex-shrink-0 mt-0.5" />
              <span className="text-navy-500">Дату следующей покупки — сдвигайте вперёд или назад</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckIcon className="text-amber-600 flex-shrink-0 mt-0.5" />
              <span className="text-navy-500">Паузу на месяц, не отменяя подписку</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckIcon className="text-amber-600 flex-shrink-0 mt-0.5" />
              <span className="text-navy-500">Отменить подписку в любой момент — других платежей не будет</span>
            </li>
          </ul>
          <p className="text-sm text-navy-500 mt-4">Все управление — в профиле, раздел «Подписки».</p>
        </div>
      </section>

      {/* Кому доступна */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-navy-900 mb-4">Кому доступна</h2>
        <p className="text-navy-500 leading-relaxed max-w-prose mb-3">
          Подписка доступна только зарегистрированным пользователям: нужно войти в аккаунт. Гостевой заказ подписку не включает — это гарантирует своевременную доставку и подтверждение.
        </p>
      </section>

      {/* Цена и бонусы */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-navy-900 mb-4">Цена и бонусы</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-card border border-line p-5">
            <h3 className="font-bold text-navy-900 mb-2">Скидка</h3>
            <p className="text-navy-500 text-sm leading-relaxed">
              {SUBSCRIPTION_DISCOUNT_PERCENT} % от цены товара на момент заказа. Если цена упадёт, платите меньше; если вырастет, то же скидка {SUBSCRIPTION_DISCOUNT_PERCENT} %.
            </p>
          </div>
          <div className="bg-white rounded-card border border-line p-5">
            <h3 className="font-bold text-navy-900 mb-2">Бонусы</h3>
            <p className="text-navy-500 text-sm leading-relaxed">
              С каждой покупки по подписке вы получаете бонусы как обычно — 3 % от стоимости заказа.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 bg-white rounded-card border border-line p-5 mb-10">
        <div>
          <h3 className="font-bold text-navy-900 mb-1">Готовы начать?</h3>
          <p className="text-sm text-navy-500">Выберите корм в каталоге и оформите подписку на странице товара.</p>
        </div>
        <Link to="/catalog" className="btn-primary press-wide px-6 py-3 w-full sm:w-auto whitespace-nowrap">
          Выбрать корм
        </Link>
      </div>

      {/* Ссылка на FAQ */}
      <div className="text-center pt-6 border-t border-line">
        <p className="text-navy-500">
          Ещё вопросы?{' '}
          <Link to="/faq#faq-subscription" className="font-medium text-primary-hover hover:underline">
            Подробнее о подписке в FAQ
          </Link>
        </p>
      </div>
    </div>
  )
}
