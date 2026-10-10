import { useId } from 'react'
import type { HowItWorks } from '@/types/api'
import { h2Class, h3Class, sectionClass } from './classes'

interface HowItWorksSectionProps {
  id?: string
  data: HowItWorks
  level?: 'h2' | 'h3'
}

export function HowItWorksSection({ id, data, level = 'h2' }: HowItWorksSectionProps) {
  const titleId = useId()
  const Heading = level
  const ItemHeading = level === 'h2' ? 'h3' : 'h4'
  // Сетка по числу пунктов: 4 — в ряд, 2 — пополам, остальное — по три
  const columns = data.items.length === 4 ? 'xl:grid-cols-4' : data.items.length === 2 ? '' : 'xl:grid-cols-3'

  return (
    <section id={id} aria-labelledby={titleId} className={sectionClass}>
      <Heading id={titleId} tabIndex={-1} className={level === 'h2' ? h2Class : h3Class}>
        {data.heading}
      </Heading>
      {data.lead.map((paragraph, index) => (
        <p key={index} className="max-w-prose">
          {paragraph}
        </p>
      ))}
      <ol role="list" className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${columns}`}>
        {data.items.map((item, index) => (
          <li key={index} className="flex flex-col gap-3 rounded-block bg-card p-6">
            <span aria-hidden="true" className="font-heading text-h3 font-bold leading-none tabular-nums text-gold-text">
              {String(index + 1).padStart(2, '0')}
            </span>
            {item.title && (
              <ItemHeading className="font-heading text-lg font-semibold text-foreground">{item.title}</ItemHeading>
            )}
            <p className="text-body-sm">{item.text}</p>
          </li>
        ))}
      </ol>
      {data.result && <p className="font-semibold text-foreground">{data.result}</p>}
    </section>
  )
}
