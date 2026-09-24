import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useDrawer } from '@/context/DrawerContext'

interface FaqItem {
  id: string
  question: string
  answer: ReactNode
  plain: string
}

const faqData: FaqItem[] = [
  {
    id: 'q1-authentic',
    question: 'Это оригинальная косметика?',
    answer: (
      <>
        Да. Мы продаём ISSEIMI и GLACÉE Skincare напрямую от официального
        дистрибьютора в России — компании «БьютиМедГрупп», которая работает с
        испанским производителем с 2017 года.
      </>
    ),
    plain: 'Да. Мы продаём ISSEIMI и GLACÉE Skincare напрямую от официального дистрибьютора в России — компании «БьютиМедГрупп», которая работает с испанским производителем с 2017 года.',
  },
  {
    id: 'q2-selection',
    question: 'Как подобрать уход под мой тип кожи?',
    answer: (
      <>
        Пройдите короткий{' '}
        <FaqQuizLink />
        — он учитывает тип кожи и задачу и предложит средства из каталога.
        Если сомневаетесь, напишите нам: подскажем по составу и порядку нанесения.
      </>
    ),
    plain: 'Пройдите короткий подбор — он учитывает тип кожи и задачу и предложит средства из каталога. Если сомневаетесь, напишите нам: подскажем по составу и порядку нанесения.',
  },
  {
    id: 'q3-shipping',
    question: 'Сколько стоит доставка?',
    answer: (
      <>
        Доставляем СДЭК по всей России. В пункт выдачи или постамат — бесплатно
        от 6 000 ₽, курьером — бесплатно от 10 000 ₽; при меньшей сумме — 200 ₽.
        В Москве можно забрать заказ самостоятельно.
      </>
    ),
    plain: 'Доставляем СДЭК по всей России. В пункт выдачи или постамат — бесплатно от 6 000 ₽, курьером — бесплатно от 10 000 ₽; при меньшей сумме — 200 ₽. В Москве можно забрать заказ самостоятельно.',
  },
  {
    id: 'q4-delivery-time',
    question: 'Как быстро придёт заказ?',
    answer: (
      <>
        Срок зависит от города и способа доставки и рассчитывается при
        оформлении. Статус и трек-номер заказа видны в разделе{' '}
        <Link to="/orders" className="border-b border-current hover:opacity-80">
          «Мои заказы»
        </Link>
        .
      </>
    ),
    plain: 'Срок зависит от города и способа доставки и рассчитывается при оформлении. Статус и трек-номер заказа видны в разделе «Мои заказы».',
  },
  {
    id: 'q5-payment',
    question: 'Как оплатить заказ?',
    answer: (
      <>
        Картой онлайн при оформлении. Цены на сайте указаны в рублях.
      </>
    ),
    plain: 'Картой онлайн при оформлении. Цены на сайте указаны в рублях.',
  },
  {
    id: 'q6-returns',
    question: 'Можно ли вернуть косметику?',
    answer: (
      <>
        Косметика надлежащего качества обмену и возврату не подлежит — так
        установлено законом. От заказа можно отказаться до получения: деньги
        вернутся тем же способом в течение 5 рабочих дней. Если товар пришёл с
        браком, мы заменим его или вернём оплату.
      </>
    ),
    plain: 'Косметика надлежащего качества обмену и возврату не подлежит — так установлено законом. От заказа можно отказаться до получения: деньги вернутся тем же способом в течение 5 рабочих дней. Если товар пришёл с браком, мы заменим его или вернём оплату.',
  },
  {
    id: 'q7-pro',
    question: 'Я косметолог. Как получить профессиональные цены?',
    answer: (
      <>
        Зарегистрируйтесь и подайте заявку в разделе{' '}
        <Link to="/pro" className="border-b border-current hover:opacity-80">
          «Специалистам»
        </Link>
        : укажите ИНН, ОГРН или ОГРНИП и специализацию. После проверки откроются
        оптовые цены и кабинетные средства.
      </>
    ),
    plain: 'Зарегистрируйтесь и подайте заявку в разделе «Специалистам»: укажите ИНН, ОГРН или ОГРНИП и специализацию. После проверки откроются оптовые цены и кабинетные средства.',
  },
  {
    id: 'q8-cabinet-products',
    question: 'Чем кабинетные средства отличаются от домашних?',
    answer: (
      <>
        Кабинетные средства — концентраты, пилинги и профессиональные фасовки —
        предназначены для процедур у специалиста. Их видят и заказывают только
        косметологи с подтверждённым статусом.
      </>
    ),
    plain: 'Кабинетные средства — концентраты, пилинги и профессиональные фасовки — предназначены для процедур у специалиста. Их видят и заказывают только косметологи с подтверждённым статусом.',
  },
  {
    id: 'q9-composition',
    question: 'Где посмотреть состав средства?',
    answer: (
      <>
        Состав и способ применения указаны в карточке каждого товара. Если
        нужной информации нет, <Link to="/contacts" className="border-b border-current hover:opacity-80">напишите нам</Link> — пришлём полный состав от
        производителя.
      </>
    ),
    plain: 'Состав и способ применения указаны в карточке каждого товара. Если нужной информации нет, напишите нам — пришлём полный состав от производителя.',
  },
]

// Helper component for the quiz link inside text
function FaqQuizLink() {
  const { openQuiz } = useDrawer()
  return (
    <button
      onClick={openQuiz}
      className="border-b border-current hover:opacity-80 bg-transparent p-0 font-inherit text-inherit cursor-pointer"
    >
      подбор
    </button>
  )
}

export function FaqSection() {
  // Generate JSON-LD schema
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqData.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.plain,
      },
    })),
  }

  return (
    <>
      <section id="faq" className="bg-background py-10 md:py-14">
        <div className="container-app">
          <div className="max-w-prose mb-12 md:mb-16">
            <h2 className="text-h2 font-heading font-bold mb-4">
              Вопросы и ответы
            </h2>
          </div>

          {/* FAQ List */}
          <div className="max-w-prose space-y-0">
            {faqData.map((item, index) => (
              <details
                key={item.id}
                className={`group cursor-pointer transition-colors ${
                  index < faqData.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <summary className="list-none [&::-webkit-details-marker]:hidden py-4 md:py-6 flex items-start justify-between gap-4 min-h-11">
                  <span className="text-body-sm md:text-body font-heading font-bold text-foreground">
                    {item.question}
                  </span>
                  <svg
                    className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0 mt-0.5 transition-transform duration-200 group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </summary>
                <div className="pb-4 md:pb-6 text-body-sm md:text-body leading-body text-muted-foreground">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // Escape < to prevent breaking out of the script tag. This is safe because
          // the data is static and self-contained, not user-generated.
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
    </>
  )
}
