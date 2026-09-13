import { Link } from 'react-router-dom'
import { type CSSProperties, useEffect, useState } from 'react'
import { useMetaTags } from '../hooks/useMetaTags'
import { CONTACTS } from '../lib/contacts'
import { useOnScreen } from '../hooks/useOnScreen'
import { useSiteText } from '../context/SiteTextsContext'
import { deliveryApi } from '../lib/api'
import { formatPrice } from '../lib/format'
import type { DeliveryKind, DeliveryOptionKey } from '@simba/shared'

import { TelegramIcon } from '../components/icons'

function ClockIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function PickupPointIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21l18 0" />
      <g className="delivery-pickup">
        <path d="M3 7v1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1h-18l2 -4h14l2 4" />
      </g>
      <path d="M5 21l0 -10.15" />
      <path d="M19 21l0 -10.15" />
      <path d="M9 21v-4a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v4" />
    </svg>
  )
}

function CourierIcon() {
  const bodyPath = 'M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8m0 -5h5l3 5'
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={bodyPath} />
      <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path
        d="M4 5 L13 5 L13 6 L18 6 L21 11"
        className="delivery-sweep"
        fill="none"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="100"
      />
      <g className="delivery-trail">
        <path d="M20 4 l2.5 0" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M20 6 l2 0" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </svg>
  )
}

type DeliveryMethod = {
  icon: React.ReactNode
  name: string
  subtitle: string | null
  price: number
  isFree: boolean
}

function getIconForKind(kind: DeliveryKind): React.ReactNode {
  switch (kind) {
    case 'courier':
      return <CourierIcon />
    case 'pickup_point':
    case 'store':
      return <PickupPointIcon />
    default:
      return <PickupPointIcon />
  }
}

const iconDelay = (i: number) => ({ '--idle-delay': `${600 + i * 1400}ms` }) as CSSProperties

export default function DeliveryPage() {
  const iconsRef = useOnScreen<HTMLDivElement>()
  const [methods, setMethods] = useState<DeliveryMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    deliveryApi.options()
      .then(res => {
        const methods = res.data.options.map(opt => ({
          icon: getIconForKind(opt.kind),
          name: opt.title,
          subtitle: opt.subtitle,
          price: opt.price,
          isFree: opt.price === 0,
        }))
        setMethods(methods)
      })
      .catch(() => {
        setError(true)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useMetaTags({
    title: 'Доставка и оплата — Зоомагазин Симба, Москва',
    description:
      'Сроки и стоимость доставки кормов и товаров для животных по Москве и России. Оплата картой, СБП или наличными курьеру.',
  })

  const pageDeliveryTitle = useSiteText('page.delivery.title', 'Доставка и оплата')
  const pageDeliveryLead = useSiteText('page.delivery.lead', 'Отправляем в день заказа — любым способом')

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
      <h1 className="text-[32px] md:text-[40px] leading-tight font-bold text-navy-900 mb-3">{pageDeliveryTitle}</h1>
      <div className="flex items-center gap-2 text-navy-500 mb-10">
        <ClockIcon />
        <p>{pageDeliveryLead}</p>
      </div>

      {/* Delivery methods grid */}
      <div ref={iconsRef} className="delivery-icons grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4 mb-12">
        {loading ? (
          // Скелеты при загрузке
          Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-blue-50 rounded-card p-5 animate-pulse h-40"
            />
          ))
        ) : error ? (
          <div className="col-span-full text-center py-8">
            <p className="text-navy-500">Не удалось загрузить условия доставки</p>
          </div>
        ) : (
          methods.map((method: DeliveryMethod, idx: number) => (
            <div
              key={method.name}
              className={`relative bg-white rounded-card p-4 sm:p-5 flex flex-col ${
                method.isFree ? 'border-2 border-ink' : 'border border-line'
              }`}
            >
              {method.isFree && (
                <span className="absolute -top-2 left-4 bg-ink text-white text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full">
                  Бесплатно
                </span>
              )}
              <div style={iconDelay(idx)} className="text-navy-900 mb-3">{method.icon}</div>
              <h3 className="font-bold text-navy-900 text-sm sm:text-base mb-1">{method.name}</h3>
              <p className="text-xs sm:text-sm text-navy-500 mb-3 flex-grow">{method.subtitle || ''}</p>
              {!method.isFree && (
                <p className="text-xl sm:text-2xl font-bold text-navy-900 tabular-nums">{formatPrice(method.price)}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Content sections */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold text-navy-900 mb-4">Как получить заказ</h2>
        {/* Абзац собирается из того же прайса, что и карточки: свободный текст
            с городами и ценами однажды разошёлся с кодом и был стёрт как
            «выдуманный». Теперь расходиться нечему. */}
        <p className="text-navy-500 leading-relaxed max-w-prose">
          {loading || error
            ? 'Загружаем условия доставки…'
            : `Способ выбираете при оформлении заказа. ${methods
                .map((m) => `${m.name}${m.subtitle ? ` (${m.subtitle})` : ''} — ${
                  m.price > 0 ? formatPrice(m.price) : 'бесплатно'
                }`)
                .join('. ')}.`}
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-navy-900 mb-4">Когда отправим</h2>
        <p className="text-navy-500 leading-relaxed max-w-prose">
          Отправляем в день заказа — и в пункты выдачи, и курьером. Срок получения зависит от выбранного способа: точную дату
          вы увидите при оформлении.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-navy-900 mb-4">Как оплатить</h2>
        <p className="text-navy-500 leading-relaxed max-w-prose">
          Картой или через СБП при оформлении на сайте. Наличными — курьеру при получении. Чек приходит сразу после оплаты.
        </p>
      </section>

      {/* Info block */}
      <div className="bg-white border border-line rounded-card p-5 mt-10">
        <div className="flex items-start gap-3">
          <ClockIcon size={24} className="text-navy-700 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-navy-900 mb-2">Проверяем перед отправкой</h3>
            <p className="text-navy-500 leading-relaxed">
              Каждый заказ мы собираем и проверяем перед отправкой: сроки годности, целостность упаковки, комплектность. При
              получении вы можете сверить маркировку — если что-то не так, заменим или вернём деньги, подробнее на странице{' '}
              <Link to="/returns" className="font-medium text-navy-700 hover:text-navy-900 transition-colors duration-100 ease">
                Обмен и возврат
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Footer section */}
      <div className="mt-10 pt-6 border-t border-line flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-navy-500">
          Остались вопросы по доставке — напишите нам в Telegram, ответим за несколько минут.
        </p>
        <a
          href={CONTACTS.telegram}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary press-wide px-6 py-3 w-full sm:w-auto gap-2 whitespace-nowrap"
        >
          <TelegramIcon />
          Написать в Telegram
        </a>
      </div>
    </div>
  )
}
