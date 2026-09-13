import { useState, useId } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightIcon, ChevronDownIcon } from '../icons'
import { FAQ, renderFaqAnswer, type FaqEntry } from '../../lib/faq'
import { useSiteText } from '../../context/SiteTextsContext'

/** На главной — четыре вопроса, остальные на /faq. Источник текста один. */
const faqs = FAQ.slice(0, 4)

function FaqItem({ faq }: { faq: FaqEntry }) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <div className="bg-white border border-line rounded-card overflow-hidden">
      <button
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between p-5 text-left transition-colors duration-150 ease`}
      >
        <span className="font-semibold pr-4 text-navy-900">{faq.q}</span>
        <ChevronDownIcon open={open} className="flex-shrink-0 text-navy-900 w-5 h-5" />
      </button>
      <div
        id={id}
        role="region"
        className={`grid transition-[grid-template-rows] ease-out ${open ? 'duration-200' : 'duration-150'}`}
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden bg-white border-t border-line">
          <div
            className={`px-5 pt-4 pb-5 max-w-prose leading-relaxed text-navy-500 transition-[opacity,transform] ease-out ${open ? 'duration-200 opacity-100 translate-y-0' : 'duration-150 opacity-0 -translate-y-1'}`}
          >
            {renderFaqAnswer(faq)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FaqSection() {
  const faqTitle = useSiteText('home.faq.title', 'Вопросы и ответы')

  return (
    <section id="faq" className="scroll-mt-24 py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4">
      <h2 className="text-2xl font-bold mb-8 text-navy-900">{faqTitle}</h2>
      <div className="flex flex-col gap-3">
        {faqs.map((faq) => (
          <FaqItem key={faq.id} faq={faq} />
        ))}
      </div>
      <div className="mt-8">
        <Link
          to="/faq"
          className="link-arrow inline-flex items-center gap-1.5 text-navy-900 underline underline-offset-2 hover:opacity-80 transition-colors duration-100 ease"
        >
          Все вопросы и ответы
          <ArrowRightIcon className="w-4 h-4" />
        </Link>
      </div>
      </div>
    </section>
  )
}
