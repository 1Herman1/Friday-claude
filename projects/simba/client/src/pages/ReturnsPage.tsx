import { Link } from 'react-router-dom'
import { type CSSProperties } from 'react'
import { useMetaTags } from '../hooks/useMetaTags'
import { CONTACTS } from '../lib/contacts'
import { useOnScreen } from '../hooks/useOnScreen'
import { useSiteText } from '../context/SiteTextsContext'

import { TelegramIcon } from '../components/icons'

/** 2 иконки: шаг = 5600/2 = 2800мс, иначе вторая синхронизируется с первой. */
const iconDelay = (i: number) => ({ '--idle-delay': `${600 + i * 2800}ms` }) as CSSProperties

export default function ReturnsPage() {
  const infoRef = useOnScreen<HTMLElement>()

  useMetaTags({
    title: 'Обмен и возврат товара — Зоомагазин Симба',
    description:
      'Как вернуть или обменять корм: невскрытую упаковку принимаем 30 дней, брак — в любом случае. Порядок возврата в три шага.',
  })

  const steps = [
    {
      number: 1,
      title: 'Напишите нам',
      content: (
        <>
          В <a href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer" className="font-medium text-navy-700 hover:text-navy-900 transition-colors duration-100 ease">Telegram</a> или{' '}
          позвоните: <a href={CONTACTS.returnsPhoneHref} className="font-medium text-navy-700 hover:text-navy-900 transition-colors duration-100 ease">{CONTACTS.returnsPhone}</a>. Скажите номер заказа — он есть в письме-подтверждении и в личном
          кабинете.
        </>
      ),
    },
    {
      number: 2,
      title: 'Передайте товар',
      content:
        'Отправьте через удобный пункт выдачи или передайте курьеру при следующей доставке — как удобнее.',
    },
    {
      number: 3,
      title: 'Получите деньги',
      content:
        'Вернём на карту, с которой была оплата. Если выбрали замену — привезём новый корм в обычные сроки доставки.',
    },
  ]

  const pageReturnsTitle = useSiteText('page.returns.title', 'Обмен и возврат')

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
      <h1 className="text-[32px] md:text-[40px] leading-tight font-bold text-navy-900 mb-4">{pageReturnsTitle}</h1>
      <p className="text-lg text-navy-500 max-w-prose mb-10">
        Не подошёл корм — вернём деньги или заменим на другой. Невскрытую упаковку принимаем в течение 30 дней с момента
        покупки, без объяснения причин.
      </p>

      {/* Steps */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-navy-900 mb-6">Как вернуть товар — три шага</h2>
        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.number} className="bg-white border border-line rounded-card p-5 flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-ink text-white rounded-full flex items-center justify-center font-bold text-sm">
                {step.number}
              </div>
              <div className="flex-grow">
                <h3 className="font-bold text-navy-900 mb-2">{step.title}</h3>
                <p className="text-navy-500 leading-relaxed">
                  {typeof step.content === 'string' ? step.content : step.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Info blocks */}
      <section ref={infoRef} className="returns-icons space-y-5 mb-12">
        <div className="bg-white border border-line rounded-card p-5">
          <div className="flex items-start gap-3">
            <svg style={iconDelay(0)} aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-navy-700 flex-shrink-0 mt-0.5">
              <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
              <g className="returns-alert">
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </g>
            </svg>
            <div>
              <h3 className="font-bold text-navy-900 mb-2">Что вернуть нельзя</h3>
              <p className="text-navy-500 leading-relaxed">
                Вскрытые упаковки корма и лакомств мы принять не можем — этого требуют санитарные нормы (Постановление
                Правительства РФ № 2463): корма относятся к товарам, не подлежащим возврату после вскрытия. Поэтому, если вы
                не уверены, подойдёт ли корм, начните с маленькой упаковки — а ещё лучше спросите нас, мы поможем подобрать.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-line rounded-card p-5">
          <div className="flex items-start gap-3">
            <svg style={iconDelay(1)} aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-navy-700 flex-shrink-0 mt-0.5">
              <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
              <g className="returns-check">
                <path d="M9 12l2 2l4 -4" />
              </g>
            </svg>
            <div>
              <h3 className="font-bold text-navy-900 mb-2">Если товар с браком</h3>
              <p className="text-navy-500 leading-relaxed">
                Если вы обнаружили заводской брак, нарушенную упаковку или несоответствие срока годности — мы заменим товар или
                вернём деньги независимо от того, вскрыта упаковка или нет. Напишите нам и приложите фото, остальное мы возьмём
                на себя.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 pt-6 border-t border-line">
        <p className="text-navy-500">Хотите оформить возврат — </p>
        <a
          href={CONTACTS.telegram}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary px-6 py-3 gap-2"
        >
          <TelegramIcon />
          Написать в Telegram
        </a>
      </div>
    </div>
  )
}
