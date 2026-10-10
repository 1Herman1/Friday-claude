import { useId } from 'react'
import { IconChevronDown } from '../../icons'
import { h2Class, scrollMt } from './classes'

interface InciSectionProps {
  id: string
  text: string | null
}

export function InciSection({ id, text }: InciSectionProps) {
  const titleId = useId()

  if (!text) return null

  return (
    <section id={id} aria-labelledby={titleId} className={scrollMt}>
      <details className="group">
        <summary className="block min-h-11 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <h2 id={titleId} tabIndex={-1} className={`${h2Class} flex min-h-11 items-center justify-between gap-3`}>
            <span>Состав (INCI)</span>
            <IconChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
          </h2>
        </summary>
        <p className="mt-4 max-w-prose whitespace-pre-line break-words text-body-sm text-muted-foreground">{text}</p>
      </details>
    </section>
  )
}
