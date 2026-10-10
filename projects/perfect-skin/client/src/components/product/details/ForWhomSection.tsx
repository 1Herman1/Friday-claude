import { useId } from 'react'
import { IconCheck } from '../../icons'
import type { ForWhom } from '@/types/api'
import { h2Class, h3Class, sectionClass } from './classes'

interface ForWhomSectionProps {
  id?: string
  data: ForWhom
  level?: 'h2' | 'h3'
}

export function ForWhomSection({ id, data, level = 'h2' }: ForWhomSectionProps) {
  const titleId = useId()
  const Heading = level

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={`${sectionClass} rounded-block bg-accent p-6 text-accent-foreground md:p-8 lg:col-span-5 lg:self-start`}
    >
      <Heading id={titleId} tabIndex={-1} className={level === 'h2' ? h2Class : h3Class}>
        Кому подойдёт
      </Heading>
      {data.lead && <p className="max-w-prose">{data.lead}</p>}
      <ul role="list" className="flex flex-col gap-3">
        {data.items.map((item, index) => (
          <li key={index} className="flex gap-3">
            <IconCheck className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {data.note.map((paragraph, index) => (
        <p key={index} className="text-body-sm">
          {paragraph}
        </p>
      ))}
    </section>
  )
}
