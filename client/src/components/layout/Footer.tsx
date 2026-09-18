import { useState } from 'react'
import { Link } from 'react-router-dom'
import MarketplaceCard from '../MarketplaceCard'
import { CONTACTS, MARKETPLACES, LEGAL } from '../../lib/contacts'
import { TelegramIcon, PhoneIcon, ChevronDownIcon, WalletIcon } from '../icons'

export default function Footer() {
  const [buyers2Open, setBuyers2Open] = useState(false)
  const [about2Open, setAbout2Open] = useState(false)

  // Контакты в первой колонке
  const buyersLinks = [
    { label: 'Доставка и оплата', to: '/delivery' },
    { label: 'Обмен и возврат', to: '/returns' },
    { label: 'Бонусная программа', to: '/bonuses' },
    { label: 'Подписка на корм', to: '/subscription' },
    { label: 'Подбор корма за 1 минуту', to: '/questionnaire' },
    { label: 'Вопросы и ответы', to: '/faq' },
  ]

  const aboutLinks: Array<{
    label: string
    to: string
    hash?: string
  }> = [
    { label: 'О компании', to: '/about' },
    { label: 'Почему нам доверяют', to: '/trust' },
    { label: 'Сертификаты кормов', to: '/certificates' },
    { label: 'Отзывы', to: '/reviews' },
    { label: 'Блог', to: '/blog' },
  ]

  return (
    <footer className="bg-blue-50 border-t border-line mt-12">
      {/* Верхняя часть — 4 колонки на десктопе, 1 на мобиле */}
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">

        {/* Колонка 1: НАПИШИТЕ НАМ */}
        <div className="flex flex-col gap-4">
          <h3 className="font-bold text-navy-900 uppercase tracking-wide text-sm">Напишите нам</h3>

          {/* Кнопка Telegram — крупная синяя CTA */}
          <a
            href={CONTACTS.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary press-wide w-full px-3 py-3"
            aria-label="Написать нам в Telegram — ответим за 10 минут"
          >
            <span className="flex items-center justify-center gap-2 whitespace-nowrap">
              <TelegramIcon />
              Telegram — ответим за 10 минут
            </span>
          </a>

          {/* Telegram-канал */}
          <a
            href={CONTACTS.telegramChannel}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-base md:text-sm text-navy-700 hover:text-primary-hover transition-colors duration-100 ease min-h-11 md:min-h-auto"
            aria-label="Наш Telegram-канал"
          >
            <TelegramIcon />
            Наш Telegram-канал
          </a>

          {/* Телефон */}
          <a
            href={CONTACTS.phoneHref}
            className="flex items-center gap-2 text-base md:text-sm text-navy-900 hover:text-primary-hover transition-colors duration-100 ease min-h-11 md:min-h-auto"
          >
            <PhoneIcon />
            {CONTACTS.phone}
          </a>

          {/* Два абзаца информации */}
          <div className="space-y-2 text-base md:text-sm text-navy-500">
            <p>{CONTACTS.orders}</p>
            <p>{CONTACTS.hours}</p>
          </div>

          {/* Почта */}
          <div className="flex items-baseline gap-2 text-base md:text-sm">
            <a href={CONTACTS.emailHref} className="text-navy-700 hover:text-primary-hover transition-colors duration-100 ease">
              {CONTACTS.email}
            </a>
            <span className="text-navy-500"> — для юрлиц и поставщиков</span>
          </div>
        </div>

        {/* Колонка 2: ПОКУПАТЕЛЯМ — аккордеон на мобиле */}
        <div className="flex flex-col">
          <button
            onClick={() => setBuyers2Open(!buyers2Open)}
            className="md:hidden flex items-center justify-between py-3 min-h-11 font-bold text-navy-900 uppercase tracking-wide text-sm mb-2 hover:text-primary-hover transition-colors duration-100 ease"
            aria-expanded={buyers2Open}
            aria-controls="buyers-accordion"
          >
            Покупателям
            <ChevronDownIcon open={buyers2Open} className="w-5 h-5" />
          </button>

          <h3 className="hidden md:block font-bold text-navy-900 uppercase tracking-wide text-sm mb-4">Покупателям</h3>

          {/* На десктопе всегда видно, на мобиле — через аккордеон */}
          <nav
            id="buyers-accordion"
            className="gap-2 overflow-hidden transition-[grid-template-rows] duration-200 ease-out md:!transition-none md:!overflow-visible md:!flex md:!flex-col md:!gap-4"
            style={{
              display: 'grid',
              gridTemplateRows: buyers2Open ? '1fr' : '0fr',
            }}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-2">
                {buyersLinks.map((item) => (
                  <Link key={item.to} to={item.to} className="text-base md:text-sm text-navy-700 hover:text-primary-hover transition-colors duration-100 ease">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </nav>
        </div>

        {/* Колонка 3: О МАГАЗИНЕ — аккордеон на мобиле */}
        <div className="flex flex-col">
          <button
            onClick={() => setAbout2Open(!about2Open)}
            className="md:hidden flex items-center justify-between py-3 min-h-11 font-bold text-navy-900 uppercase tracking-wide text-sm mb-2 hover:text-primary-hover transition-colors duration-100 ease"
            aria-expanded={about2Open}
            aria-controls="about-accordion"
          >
            О магазине
            <ChevronDownIcon open={about2Open} className="w-5 h-5" />
          </button>

          <h3 className="hidden md:block font-bold text-navy-900 uppercase tracking-wide text-sm mb-4">О магазине</h3>

          {/* На десктопе всегда видно, на мобиле — через аккордеон */}
          <nav
            id="about-accordion"
            className="gap-2 overflow-hidden transition-[grid-template-rows] duration-200 ease-out md:!transition-none md:!overflow-visible md:!flex md:!flex-col md:!gap-4"
            style={{
              display: 'grid',
              gridTemplateRows: about2Open ? '1fr' : '0fr',
            }}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-2">
                {aboutLinks.map((item) => (
                  <div key={item.label}>
                    {item.hash ? (
                      <a href={`${item.to}${item.hash}`} className="text-base md:text-sm text-navy-700 hover:text-primary-hover transition-colors duration-100 ease">
                        {item.label}
                      </a>
                    ) : (
                      <Link to={item.to} className="text-base md:text-sm text-navy-700 hover:text-primary-hover transition-colors duration-100 ease">
                        {item.label}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </nav>
        </div>

        {/* Колонка 4: НАМ ДОВЕРЯЮТ */}
        <div className="flex flex-col gap-4">
          <h3 className="font-bold text-navy-900 uppercase tracking-wide text-sm">Нам доверяют</h3>

          <div className="flex flex-col gap-3">
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

          {/* Пояснение под карточками */}
          <p className="text-base md:text-sm text-navy-500">Заказывая на сайте, вы получаете бонусы и цены без наценки площадок.</p>
        </div>
      </div>

      {/* Нижняя полоса */}
      <div className="border-t border-line bg-blue-50">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row md:items-start md:justify-between gap-6 text-base md:text-sm text-navy-500">
          {/* Левая часть: copyright + оплата (строка часов убрана — дублирует колонку 1) */}
          <div className="space-y-2 flex-1">
            <p>© 2026 Симба · {LEGAL.entity} · {LEGAL.inn} · Москва</p>
            <p className="flex items-center gap-1.5">
              <WalletIcon className="w-3.5 h-3.5" />
              Оплата: МИР · Visa · Mastercard · СБП
            </p>
          </div>

          {/* Правая часть: три мета-пункта в один ряд, на мобиле — перенос.
              «Разработка сайтов» — студии пока нет, остаётся статичным текстом. */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 md:justify-end text-navy-700">
            <span className="cursor-default">Разработка сайтов</span>
            <Link to="/consent" className="hover:text-primary-hover transition-colors duration-100 ease">
              Согласие на обработку данных
            </Link>
            <Link to="/privacy" className="hover:text-primary-hover transition-colors duration-100 ease">
              Политика конфиденциальности
            </Link>
            <Link to="/offer" className="hover:text-primary-hover transition-colors duration-100 ease">
              Публичная оферта
            </Link>
          </div>
        </div>

        {/* Отступ для фиксированного мобильного навбара */}
        <div className="pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0" />
      </div>
    </footer>
  )
}
