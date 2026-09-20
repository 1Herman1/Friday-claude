import { Link } from 'react-router-dom'
import { LOYALTY_STYLE } from '../lib/loyalty-style'
import { CheckIcon } from '../components/icons'
import { type CSSProperties } from 'react'
import { useMetaTags } from '../hooks/useMetaTags'
import { useSiteText } from '../context/SiteTextsContext'
import CountUp from '../components/CountUp'
import { useOnScreen } from '../hooks/useOnScreen'
import { LOYALTY_TIERS, type BonusLevel } from '@simba/shared'

/** Подарок: коробка + крышка (кант — Tabler icons/outline/gift.svg, MIT) и
    свой бант из зеркальных петель. Двигается только крышка с бантом
    (.bonus-gift) — коробка стоит на месте. */
function GiftIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
      <path d="M12 12v9" />
      <g className="bonus-gift">
        <rect x="3" y="8" width="18" height="4" rx="1" />
        <path d="M12 8v4" />
        <path d="M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5" />
      </g>
    </svg>
  )
}

/** Монета со знаком процента: бонус как валюта, списание как доля чека.
    Двигается только глиф процента (.bonus-percent), кант монеты неподвижен. */
function PercentIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <g className="bonus-percent">
        <path d="M8 16 16 8" />
        <circle cx="9" cy="9" r="1.25" fill="currentColor" stroke="none" />
        <circle cx="15" cy="15" r="1.25" fill="currentColor" stroke="none" />
      </g>
    </svg>
  )
}

/** Кошелёк с кармашком под карту и купюрой, выглядывающей сверху.
    Двигается только купюра (.bonus-wallet) — она утапливается в кошелёк. */
function WalletIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g className="bonus-wallet">
        <path d="M7 8V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v3" />
      </g>
      <rect x="2" y="8" width="20" height="12" rx="2" />
      <path d="M22 12h-5a2 2 0 0 0 0 4h5" />
    </svg>
  )
}

/** Тот же стаггер, что в Advantages/Trust: 600мс форы + 1400мс шаг —
    в движении всегда ровно одна иконка. */
const iconDelay = (i: number) => ({ '--idle-delay': `${600 + i * 1400}ms` }) as CSSProperties

// Шкала нагрева: холод → тепло → жар
const LEVELS_PERKS: Record<BonusLevel, { perks: string[] }> = {
  newcomer: {
    perks: ['Начисление 5% с каждого заказа', 'Оплата бонусами: 1 = 1 ₽, до 50% чека'],
  },
  active: {
    perks: ['Начисление 5% с каждого заказа', 'Оплата бонусами: 1 = 1 ₽, до 50% чека', 'Приоритетная поддержка'],
  },
  premium: {
    perks: ['Начисление 5% с каждого заказа', 'Оплата бонусами: 1 = 1 ₽, до 50% чека', 'Приоритетная поддержка', 'Эксклюзивные акции'],
  },
}

export default function BonusesPage() {
  const iconsRef = useOnScreen<HTMLDivElement>()

  useMetaTags({
    title: 'Бонусная программа — Зоомагазин Симба',
    description:
      '5% с каждого заказа возвращается бонусами, 300 приветственных при регистрации. Бонусами можно оплатить до половины суммы заказа.',
  })

  const pageBonusesTitle = useSiteText('page.bonuses.title', 'Бонусная программа')

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">

      {/* Заголовок */}
      <h1 className="text-[32px] md:text-[40px] leading-tight font-bold text-navy-900 mb-3">
        {pageBonusesTitle}
      </h1>
      <p className="text-navy-500 max-w-prose mb-10 leading-relaxed">
        Накапливайте бонусы с каждого заказа и тратьте их на следующие покупки.
      </p>

      {/* Крупная сводка */}
      <div className="bg-white border border-line rounded-card p-6 mb-10">
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="flex-1">
            <CountUp value={5} suffix="%" className="block text-[40px] font-black text-navy-900" />
            <p className="text-navy-500 leading-relaxed">
              от стоимости товаров в каждом заказе возвращается бонусами · 1 бонус = 1 рубль
            </p>
            <p className="text-xs text-navy-500 mt-3">
              Начисление идёт от товарной части, оплаченной деньгами. Доставка в расчёт не входит, списанные бонусы из базы вычитаются.
            </p>
          </div>
        </div>
      </div>

      {/* Три карточки */}
      <h2 className="text-2xl font-bold text-navy-900 mb-4">Как это работает</h2>
      <div ref={iconsRef} className="bonus-icons grid md:grid-cols-3 gap-4 mb-10">
        {/* Карточка 1 */}
        <div className="bg-white border border-line rounded-card p-5">
          <span style={iconDelay(0)} className="block text-navy-900 mb-4">
            <GiftIcon />
          </span>
          <h3 className="font-bold text-navy-900 mb-2">300 бонусов новому клиенту</h3>
          <p className="text-navy-500 text-sm">
            Каждый новый покупатель получает 300 приветственных бонусов при регистрации. Потратить их можно уже при первой покупке.
          </p>
        </div>

        {/* Карточка 2 */}
        <div className="bg-white border border-line rounded-card p-5">
          <span style={iconDelay(1)} className="block text-navy-900 mb-4">
            <PercentIcon />
          </span>
          <h3 className="font-bold text-navy-900 mb-2">Как списывать</h3>
          <p className="text-navy-500 text-sm">
            Бонусами можно оплатить до 50% суммы заказа. При оформлении укажите, сколько списать — остаток сохранится на счёте.
          </p>
        </div>

        {/* Карточка 3 */}
        <div className="bg-white border border-line rounded-card p-5">
          <span style={iconDelay(2)} className="block text-navy-900 mb-4">
            <WalletIcon />
          </span>
          <h3 className="font-bold text-navy-900 mb-2">Где смотреть баланс</h3>
          <p className="text-navy-500 text-sm">
            Все бонусы, история заказов и начислений — в личном кабинете.
          </p>
        </div>
      </div>

      {/* Таблица уровней */}
      <h2 className="text-2xl font-bold text-navy-900 mb-4">Уровни участника</h2>
      <div className="flex flex-col gap-3 mb-8">
        {LOYALTY_TIERS.map((tier, idx) => {
          const nextTier = LOYALTY_TIERS[idx + 1]
          const rangeText = nextTier
            ? `${tier.minPoints.toLocaleString('ru-RU')} — ${(nextTier.minPoints - 1).toLocaleString('ru-RU')} бонусов`
            : `от ${tier.minPoints.toLocaleString('ru-RU')} бонусов`
          return (
            <div key={tier.key} className="bg-white border border-line rounded-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${LOYALTY_STYLE[tier.key]}`}>
                  {tier.label}
                </span>
                <span className="text-xs text-navy-500">{rangeText}</span>
              </div>
              <ul className="flex flex-col gap-1">
                {LEVELS_PERKS[tier.key].perks.map(perk => (
                  <li key={perk} className="text-sm text-navy-700 flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-amber-600" /> {perk}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {/* Мелкий текст */}
      <p className="text-sm text-navy-500 mb-10">
        Бонусы начисляются после оплаты заказа и не сгорают — срок их действия не ограничен.
      </p>

      {/* Блок про подбор корма */}
      <div className="bg-white border border-line rounded-card p-6 text-center">
        <h2 className="text-2xl font-bold text-navy-900 mb-3">
          Не знаете, какой корм выбрать?
        </h2>
        <p className="text-navy-500 mb-6 leading-relaxed">
          Ответьте на несколько вопросов о питомце — и мы порекомендуем конкретный корм: линейку и вкус, а не просто бренд. Это займёт около минуты.
        </p>
        <Link
          to="/questionnaire"
          className="btn-primary px-6"
        >
          Подобрать корм
        </Link>
        {/* Звезда стоит в строке текста (inline-block с вертикальным
            выравниванием), а не отдельной колонкой слева от двух строк. */}
        <p className="mt-4 text-center text-sm text-navy-500">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="inline-block align-[-3px] mr-1.5 text-amber-600">
            <polyline points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
          </svg>
          После подбора — 300 бонусов на первую покупку
        </p>
      </div>

    </div>
  )
}
