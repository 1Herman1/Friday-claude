import { Link } from 'react-router-dom'
import { type CSSProperties } from 'react'
import { useMetaTags } from '../hooks/useMetaTags'
import { useSiteText } from '../context/SiteTextsContext'
import CountUp from '../components/CountUp'
import MarketplaceCard from '../components/MarketplaceCard'
import { CONTACTS, MARKETPLACES } from '../lib/contacts'
import { TelegramIcon } from '../components/icons'
import { useOnScreen } from '../hooks/useOnScreen'

/** Те же 4 иконки, что в TrustSection.tsx на главной — это одни и те же
    гарантии в двух местах сайта, у них должна быть одна визуальная форма.
    Геометрия — Tabler Icons (MIT): award.svg + своя галочка, calendar-check.svg. */
function VerifiedIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g className="trust-shield">
        <path d="M6 9a6 6 0 1 0 12 0a6 6 0 1 0 -12 0" />
        <path d="M12 15l3.4 5.89l1.598 -3.233l3.598 .232l-3.4 -5.889" />
        <path d="M6.802 12l-3.4 5.89l3.598 -.233l1.598 3.232l3.4 -5.889" />
        <polyline points="9.5 9 11 10.5 14 7.5" />
      </g>
    </svg>
  )
}

function FreshDateIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11.5 21h-5.5a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v6" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M4 11h16" />
      <g className="trust-check">
        <path d="M15 19l2 2l4 -4" />
      </g>
    </svg>
  )
}

function LoyalHeartIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g className="trust-cycle">
        <path d="M4 12a8 8 0 0 1 16 0" />
        <polyline points="18 10 20 12 22 10" />
        <path d="M20 12a8 8 0 0 1-16 0" />
        <polyline points="6 14 4 12 2 14" />
      </g>
      <path d="M12 16C9.5 14 8 12.5 8 11A2 2 0 0 1 12 11A2 2 0 0 1 16 11C16 12.5 14.5 14 12 16Z" />
    </svg>
  )
}

function ReturnBoxIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <g className="trust-return">
        <line x1="15.5" y1="14.5" x2="8.5" y2="14.5" />
        <polyline points="11.5 11.5 8.5 14.5 11.5 17.5" />
      </g>
    </svg>
  )
}

/** Пузырь — Tabler icons/outline/message-dots.svg (MIT), три точки
    подпрыгивают волной слева направо, ответ уже набирают. Самолётик Telegram
    сюда не берём: он уже занят кнопкой ниже. */
function TypingReplyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3l12 0" />
      <g className="trust-message">
        <circle cx="8" cy="11" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="11" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="16" cy="11" r="1.1" fill="currentColor" stroke="none" />
      </g>
    </svg>
  )
}

/** Тот же тональный код, что в TrustSection.tsx: синий — про товар и проверку,
    янтарный — про людей и сервис. */
const TONE = {
  primary: 'text-navy-900',
  amber: 'text-amber-600',
} as const

/** 5 карточек против 4 в TrustSection: шаг стаггера = цикл / число иконок,
    иначе 5-я иконка (600+4*1400=6200мс ≡ 600мс) синхронизируется с первой. */
const iconDelay = (i: number) => ({ '--idle-delay': `${600 + i * 1120}ms` }) as CSSProperties


export default function TrustPage() {
  const iconsRef = useOnScreen<HTMLDivElement>()

  useMetaTags({
    title: 'Почему нам доверяют — Зоомагазин Симба',
    description:
      'Прямые поставки, документы на каждую партию, живые сроки годности, 24 000+ заказов и рейтинг 4,9 на трёх площадках.',
  })

  const reasons = [
    {
      icon: <VerifiedIcon />,
      tone: 'primary' as const,
      title: 'Оригинальная продукция',
      content: (
        <>
          Прямые поставки от официальных дистрибьюторов, документы на каждую партию — сканы на странице{' '}
          <Link to="/certificates" className="font-medium text-navy-700 hover:text-navy-900 transition-colors duration-100 ease">
            Сертификаты
          </Link>
          .
        </>
      ),
    },
    {
      icon: <FreshDateIcon />,
      tone: 'primary' as const,
      title: 'Живые сроки годности',
      content: 'Проверяем каждую поставку на приёмке. Вы можете проверить маркировку при получении, до оплаты.',
    },
    {
      icon: <LoyalHeartIcon />,
      tone: 'primary' as const,
      title: 'Половина заказов — повторные',
      content:
        'Люди возвращаются туда, где корм оригинальный, сроки живые, а упаковка целая.',
    },
    {
      icon: <ReturnBoxIcon />,
      tone: 'amber' as const,
      title: 'Возврат без бюрократии',
      content: (
        <>
          Невскрытую упаковку принимаем 30 дней. Брак меняем без вопросов.{' '}
          <Link to="/returns" className="font-medium text-navy-700 hover:text-navy-900 transition-colors duration-100 ease">
            Условия возврата
          </Link>
        </>
      ),
    },
    {
      icon: <TypingReplyIcon />,
      tone: 'amber' as const,
      title: 'Отвечаем быстро',
      content: 'Telegram, ежедневно 9:00–21:00, обычно в течение 10 минут.',
    },
  ]

  const pageTrustTitle = useSiteText('page.trust.title', 'Почему нам доверяют')
  const pageTrustSubtitle = useSiteText('page.trust.subtitle', 'Не обещания, а то, что можно проверить')

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
      <h1 className="text-[32px] md:text-[40px] leading-tight font-bold text-navy-900 mb-2">{pageTrustTitle}</h1>
      <p className="text-navy-500 mb-10">{pageTrustSubtitle}</p>

      {/* Цифра и площадки — прямо на фоне страницы: белые карточки на подложке
          были карточкой в карточке и съедали ширину на телефоне */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-6">
        <CountUp value={24000} suffix="+" className="text-[40px] leading-none font-black text-navy-900 whitespace-nowrap" />
        <p className="text-navy-500">заказов на трёх площадках · рейтинг 4,9 на каждой</p>
      </div>

      <h2 className="text-2xl font-bold text-navy-900 mb-4">Что говорят площадки</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
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

      {/* Reasons grid */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-navy-900 mb-4">Что мы гарантируем</h2>
        <div ref={iconsRef} className="trust-icons grid md:grid-cols-2 gap-4">
          {reasons.map((reason, index) => (
            <div
              key={reason.title}
              className={`bg-white border border-line rounded-card p-5 ${index === 0 ? 'md:col-span-2' : ''}`}
            >
              <div style={iconDelay(index)} className={`mb-3 ${TONE[reason.tone]}`}>{reason.icon}</div>
              <h3 className="font-bold text-navy-900 mb-2">{reason.title}</h3>
              <p className="text-navy-500 leading-relaxed">
                {reason.content}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-10 pt-6 border-t border-line flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-navy-500">Остались сомнения — спросите нас напрямую. Отвечаем за 10 минут.</p>
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
