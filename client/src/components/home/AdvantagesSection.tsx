import { type CSSProperties } from 'react'
import { useOnScreen } from '../../hooks/useOnScreen'
import { useSiteText } from '../../context/SiteTextsContext'

/** Геометрия — Tabler Icons (MIT), icons/outline/package.svg. */
function PackageIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g className="adv-rock">
        <path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5" />
        <path d="M12 12l8 -4.5" />
        <path d="M12 12l0 9" />
        <path d="M12 12l-8 -4.5" />
        <path d="M16 5.25l-8 4.5" />
      </g>
    </svg>
  )
}

/** Геометрия — Tabler Icons (MIT), icons/outline/adjustments.svg,
    двигается только ручка среднего трека (.adv-pull). */
function SlidersIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M6 4v4" />
      <path d="M6 12v8" />
      <path d="M12 4v16" />
      <path d="M16 7a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M18 4v1" />
      <path d="M18 9v11" />
      <g className="adv-pull">
        <path d="M10 16a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      </g>
    </svg>
  )
}

/** Геометрия — Tabler Icons (MIT), icons/outline/tag.svg. */
function TagIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g className="adv-swing">
        <path d="M6.5 7.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
        <path d="M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3" />
      </g>
    </svg>
  )
}

/** Геометрия — Tabler Icons (MIT), icons/outline/clock.svg. */
function ClockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
      <g className="adv-sweep">
        <path d="M12 7v5l3 3" />
      </g>
    </svg>
  )
}

/** Два тона на четыре карточки: синий — про товар и сервис, янтарный — про выгоду
    и удобство. Пара вместо четырёх одинаковых плиток. */
const TONE = {
  primary: 'bg-primary-tint text-primary-soft',
  amber: 'bg-amber-50 text-amber-600',
} as const

const advantages = [
  {
    title: 'Спецупаковка корма',
    desc: 'Отправляем заказы в дополнительной защите — плёнка и уголки, чтобы дорогой лечебный корм не пришёл помятым.',
    icon: <PackageIcon />,
    tone: 'primary' as const,
  },
  {
    title: 'Подбор корма',
    desc: 'Подбор под аллергию, возраст, породу и болезни вашего питомца, не занимаемся навязыванием дорогих брендов.',
    icon: <SlidersIcon />,
    tone: 'primary' as const,
  },
  {
    title: 'Экономия',
    desc: 'Не закладываем в цену комиссию Ozon и Wildberries (5–15%). Вы платите только за корм и доставку.',
    icon: <TagIcon />,
    tone: 'amber' as const,
  },
  {
    title: 'Автозаказ',
    desc: 'Настраиваем регулярную доставку корма, который заканчивается. Деньги списываются автоматически — вы ничего не забываете.',
    icon: <ClockIcon />,
    tone: 'amber' as const,
  },
]

/** Фазовый сдвиг: активная фаза жеста = 1400мс, шаг стаггера тоже 1400мс —
    в движении всегда ровно одна иконка. 600мс форы, чтобы жест не наложился
    на scroll-reveal самой секции (420мс). */
const iconDelay = (i: number) => ({ '--adv-delay': `${600 + i * 1400}ms` }) as CSSProperties

export default function AdvantagesSection() {
  const listRef = useOnScreen<HTMLUListElement>()
  const advantagesTitle = useSiteText('home.advantages.title', 'Почему у нас')
  const advantagesSubtitle = useSiteText('home.advantages.subtitle', 'Что мы делаем иначе, чем маркетплейс')

  return (
    <section id="advantages" aria-labelledby="advantages-title" className="scroll-mt-24 py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4">
        <h2 id="advantages-title" className="text-2xl font-bold text-navy-900">
          {advantagesTitle}
        </h2>
        <p className="mt-2 text-navy-500 max-w-prose leading-relaxed">
          {advantagesSubtitle}
        </p>

        <ul ref={listRef} role="list" className="adv-icons mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {advantages.map((adv, i) => (
            <li key={adv.title} className="bg-white border border-line rounded-card p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span
                  style={iconDelay(i)}
                  className={`w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center ${TONE[adv.tone]}`}
                >
                  {adv.icon}
                </span>
                <h3 className="font-bold text-lg text-navy-900">{adv.title}</h3>
              </div>
              <p className="mt-3 text-navy-500 leading-relaxed">{adv.desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
