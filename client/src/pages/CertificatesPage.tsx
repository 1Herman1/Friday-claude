import { useMetaTags } from '../hooks/useMetaTags'
import { useSiteText } from '../context/SiteTextsContext'
import { CONTACTS } from '../lib/contacts'

/** Декларация: лист документа + печать-медаль с лентой, наполовину перекрывающая
    нижний левый угол листа. Геометрия — Tabler icons/outline/certificate.svg (MIT),
    отзеркалена по X. Двигается только печать (.cert-seal) при наведении на карточку. */
function CertificateIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 17h8a2 2 0 0 0 2 -2v-10a2 2 0 0 0 -2 -2h-12a2 2 0 0 0 -2 2v9.8" />
      <path d="M9 7h8" />
      <path d="M9 10.5h5" />
      <g className="cert-seal">
        <path d="M7.5 16.5m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
        <path d="M5.4 18.7v3.3l2.1 -1.5l2.1 1.5v-3.3" />
      </g>
    </svg>
  )
}

/**
 * Сертификаты и декларации. Массив данных ниже готов принять реальные файлы.
 * Когда понадобится добавить документ:
 * 1. Скопировать сканированный PDF в client/public/ (например: public/certificates/farmina-nd-declaration.pdf)
 * 2. Заполнить поле file: '/certificates/farmina-nd-declaration.pdf'
 * 3. Кликабельная карточка автоматически соберётся с ссылкой и aria-label
 */
type Certificate = {
  brand: string
  doc: string
  file: string | null
}

const certificates: Certificate[] = [
  { brand: 'Farmina N&D', doc: 'Декларация ЕАЭС', file: null },
  { brand: 'Farmina Vet Life', doc: 'Декларация ЕАЭС', file: null },
  { brand: 'Monge', doc: 'Декларация ЕАЭС', file: null },
  { brand: 'Monge VetSolution', doc: 'Декларация ЕАЭС', file: null },
]

export default function CertificatesPage() {
  useMetaTags({
    title: 'Сертификаты и декларации на корма — Симба',
    description:
      'Декларации соответствия ЕАЭС на корма Farmina и Monge из нашего ассортимента. Документы на конкретную партию пришлём по запросу.',
  })

  const pageCertificatesTitle = useSiteText('page.certificates.title', 'Документы на продукцию')

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
      <h1 className="text-[32px] md:text-[40px] leading-tight font-bold text-navy-900 mb-3">{pageCertificatesTitle}</h1>

      <p className="text-navy-500 max-w-prose mb-10 leading-relaxed">
        Мы работаем напрямую с официальными дистрибьюторами Farmina и Monge. Здесь опубликованы декларации соответствия на
        продукцию из нашего ассортимента. Если вы хотите увидеть документы на конкретную партию из вашего заказа — напишите
        нам в Telegram, пришлём.
      </p>

      {/* Сетка сертификатов: карточка есть всегда, файл появляется позже */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10">
        {certificates.map((cert) => (
          <div key={`${cert.brand}-${cert.doc}`}>
            {cert.file ? (
              <a
                href={cert.file}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-white border border-line rounded-card p-4 flex flex-col items-center h-full hover:border-navy-300 transition-colors duration-100 ease"
                aria-label={`${cert.doc} ${cert.brand}, откроется в новой вкладке`}
              >
                <div className="bg-blue-50 rounded-xl aspect-square flex items-center justify-center mb-3 w-full">
                  <div className="text-navy-900">
                    <CertificateIcon />
                  </div>
                </div>
                <h2 className="font-bold text-navy-900 text-center text-sm">{cert.brand}</h2>
                <p className="text-xs text-navy-500 text-center">{cert.doc}</p>
              </a>
            ) : (
              <div className="group bg-white border border-line rounded-card p-4 flex flex-col items-center h-full">
                <div className="bg-blue-50 rounded-xl aspect-square flex items-center justify-center mb-3 w-full">
                  <div className="text-navy-900">
                    <CertificateIcon />
                  </div>
                </div>
                <h2 className="font-bold text-navy-900 text-center text-sm">{cert.brand}</h2>
                <p className="text-xs text-navy-500 text-center">{cert.doc}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="mt-10 pt-6 border-t border-line flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-navy-500">Нужны документы на партию из вашего заказа</p>
        <a
          href={CONTACTS.telegram}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary px-6"
        >
          Написать в Telegram
        </a>
      </div>
    </div>
  )
}
