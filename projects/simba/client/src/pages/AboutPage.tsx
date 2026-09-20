import { Link } from 'react-router-dom'
import { useMetaTags } from '../hooks/useMetaTags'
import { useSiteText } from '../context/SiteTextsContext'
import CountUp from '../components/CountUp'
import AboutBanner from '../components/home/AboutBanner'
import { CONTACTS, LEGAL } from '../lib/contacts'

export default function AboutPage() {
  useMetaTags({
    title: 'О магазине Симба — корма Farmina и Monge',
    description:
      'Кто мы: узкий ассортимент премиальных кормов, прямые поставки от официальных дистрибьюторов, проверка каждой партии на приёмке.',
  })

  const pageAboutTitle = useSiteText('page.about.title', 'Кто мы')

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
      <h1 className="text-[32px] md:text-[40px] leading-tight font-bold text-navy-900 mb-5">{pageAboutTitle}</h1>

      {/* Баннер после заголовка: ставится в админке (Баннеры → страница «О нас»), иначе иллюстрация. */}
      <div className="mb-8"><AboutBanner /></div>
      <p className="text-navy-500 max-w-prose mb-10 leading-relaxed">
        Симба начался с простой собственной проблемы: найти импортный корм для своей собаки — гарантированно оригинальный, со свежими сроками и по честной цене, — и это оказалось сложнее, чем должно быть.
      </p>

      {/* Ключевой факт */}
      <div className="mb-10 flex items-baseline gap-4">
        <CountUp value={24000} suffix="+" className="text-[40px] font-black text-navy-900" />
        <p className="text-navy-500">заказов и 2 500 отзывов</p>
      </div>

      {/* Section 1: Ассортимент */}
      <h2 className="text-2xl font-bold text-navy-900 mb-4">Как мы выбираем ассортимент</h2>
      <p className="text-navy-500 max-w-prose leading-relaxed mb-4">
        Мне удалось найти корм для себя, и мы решили помочь людям со схожей проблемой. Благодарность людей за жизненно важный корм для своих любимцев подтолкнула меня к развитию ассортимента и открытию первого магазина.
      </p>
      <p className="text-navy-500 max-w-prose leading-relaxed mb-10">
        Мы осознанно продаём узкий ассортимент: Farmina, Monge и ещё несколько брендов, за которые готовы отвечать. Я обожаю животных и подбираю для магазина только те корма, которые готова дать своим питомцам.
      </p>

      {/* Section 2: Проверка партий */}
      <h2 className="text-2xl font-bold text-navy-900 mb-4">Как проверяем партии</h2>
      <p className="text-navy-500 max-w-prose leading-relaxed mb-10">
        Все поставки — напрямую от официальных дистрибьюторов. Каждую партию мы проверяем на приёмке: сроки годности, целостность упаковки, документы. Храним корма в сухом помещении с контролем температуры — так, как требует производитель, а не так, как получится. Если вы не уверены в выборе — напишите, разберёмся вместе.
      </p>

      {/* CTA section — единственный разделитель нижней части страницы */}
      <div className="mt-10 pt-6 border-t border-line flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-navy-500">
          Не знаете, какой корм подойдёт вашему питомцу
        </p>
        <Link
          to="/questionnaire"
          className="btn-primary px-6"
        >
          Подобрать за минуту
        </Link>
      </div>

      {/* Юр. реквизиты — подпись страницы: отделены отступом, без второй линии */}
      <p className="mt-8 text-sm leading-relaxed text-navy-500">
        {LEGAL.entity} · {LEGAL.inn} · {LEGAL.ogrnip} · {LEGAL.address}
      </p>
    </div>
  )
}
