import { type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { LEGAL } from '../../lib/contacts'
import { useReveal } from '../../hooks/useReveal'
import AboutBanner from './AboutBanner'
import { useSiteText } from '../../context/SiteTextsContext'


/** Каскад секции: шаг 60мс, кап 4 ступени. Текст и визуал делят одну ступень —
    разнородная группа стартует в общем окне, иначе сцена рассыпается. */
const step = (i: number) => ({ '--reveal-delay': `${Math.min(i, 3) * 60}ms` }) as CSSProperties

export default function AboutSection() {
  /** Секция подключена без обёртки <Reveal> — is-visible группе ставит свой хук. */
  const groupRef = useReveal<HTMLDivElement>()
  const aboutEyebrow = useSiteText('home.about.eyebrow', 'О компании')
  const aboutTitle = useSiteText('home.about.title', 'Кто мы')

  return (
    <section id="about" aria-labelledby="about-title" className="scroll-mt-24 py-12 md:py-16">
      <div ref={groupRef} className="reveal-group max-w-7xl mx-auto px-4">
        <div className="reveal-item" style={step(0)}>
          <p className="text-base font-semibold uppercase tracking-wide text-navy-500">{aboutEyebrow}</p>
          <h2 id="about-title" className="mt-1 text-3xl font-bold text-navy-900">{aboutTitle}</h2>
        </div>

        {/* Медиа-рамка сразу после заголовка, на всю ширину секции — по ТЗ владельца */}
        <div className="reveal-item mt-6" style={step(1)}>
          <AboutBanner />
        </div>

        <div className="mt-8">
          {/* Текст слева */}
          <div>
            <p className="reveal-item text-navy-500 max-w-prose leading-relaxed" style={step(1)}>
              Симба начался с простой собственной проблемы: найти импортный корм для своей собаки — гарантированно оригинальный, со свежими сроками и по честной цене, — и это оказалось сложнее, чем должно быть. Мне удалось найти корм для себя, и мы решили помочь людям со схожей проблемой.
            </p>
            <p className="reveal-item mt-4 text-navy-500 max-w-prose leading-relaxed" style={step(1)}>
              Мы осознанно продаём узкий ассортимент: Farmina, Monge и ещё несколько брендов, за которые готовы отвечать. Все поставки — напрямую от официальных дистрибьюторов. Каждую партию мы проверяем на приёмке: сроки годности, целостность упаковки, документы.
            </p>
            <p className="reveal-item mt-4 text-navy-500 max-w-prose leading-relaxed" style={step(1)}>
              Я обожаю животных и подбираю для магазина только те корма, которые готова дать своим питомцам. Если вы не уверены в выборе — напишите, разберёмся вместе.
            </p>

            <div className="reveal-item mt-6" style={step(3)}>
              <p className="text-navy-500">Не знаете, какой корм подойдёт вашему питомцу —</p>
              <Link to="/questionnaire" className="btn-primary mt-3 inline-flex whitespace-nowrap px-6">
                Подобрать за минуту
              </Link>
            </div>
            <div className="reveal-item mt-4" style={step(3)}>
              <Link
                to="/about"
                className="inline-flex items-center min-h-11 font-medium text-navy-700 hover:text-primary-hover transition-colors duration-100 ease"
              >
                Подробнее о компании
              </Link>
            </div>
          </div>

        </div>

        {/* Тонкая юридическая строка: разделитель на всю ширину секции,
            сам текст — в одну строку с горизонтальным скроллом на узких экранах. */}
        <div className="reveal-item mt-8 pt-6 border-t border-line" style={step(3)}>
          <p className="whitespace-nowrap overflow-x-auto scrollbar-hide text-sm leading-relaxed text-navy-500">
            {LEGAL.entity} · {LEGAL.inn} · {LEGAL.ogrnip} · {LEGAL.address}
          </p>
        </div>
      </div>
    </section>
  )
}
