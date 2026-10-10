import { useId } from 'react'
import { IconChevronDown } from '../../icons'
import type { Item, Pro, Usage } from '@/types/api'
import { h2Class, h3Class, sectionClass } from './classes'
import { ForWhomSection } from './ForWhomSection'
import { HowItWorksSection } from './HowItWorksSection'

export function hasProDescription(pro: Pro | null): boolean {
  return (
    pro !== null &&
    (pro.tagline.length > 0 || pro.intro.length > 0 || pro.howItWorks !== null || pro.forWhom !== null)
  )
}

export function hasUsageBlock(usage: Usage | null, pro: Pro | null): boolean {
  return usage !== null || Boolean(pro?.usage) || hasProDescription(pro)
}

const STEP_MARKER = /^[а-яa-z]\)\s*/i

function stepTitle(title: string): string {
  const plain = title.replace(STEP_MARKER, '')
  return plain.charAt(0).toUpperCase() + plain.slice(1)
}

function UsageStep({ step }: { step: Item }) {
  if (!step.title) return <dd className="col-span-full">{step.text}</dd>
  return (
    <div className="flex flex-col gap-1 md:contents">
      <dt className="font-semibold text-foreground">{stepTitle(step.title)}</dt>
      <dd>{step.text}</dd>
    </div>
  )
}

function UsageBody({ usage }: { usage: Usage }) {
  const [first] = usage.steps
  const hasTitles = usage.steps.some(step => step.title)
  const leadNotes = usage.notes.filter(note => note.trim().endsWith(':'))
  const tailNotes = usage.notes.filter(note => !note.trim().endsWith(':'))

  return (
    <div className="flex flex-col gap-6">
      {leadNotes.length > 0 && (
        <div className="flex max-w-prose flex-col gap-2">
          {leadNotes.map((note, index) => (
            <p key={index}>{note}</p>
          ))}
        </div>
      )}
      {usage.steps.length === 1 && first && (
        <p className="max-w-prose">
          {first.title && <span className="block font-semibold text-foreground">{first.title}</span>}
          {first.text}
        </p>
      )}
      {usage.steps.length > 1 && !hasTitles && (
        <ol role="list" className="flex flex-col gap-6">
          {usage.steps.map((step, index) => (
            <li key={index} className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-primary font-heading text-body-sm font-semibold tabular-nums text-primary-foreground"
              >
                {index + 1}
              </span>
              <p className="max-w-prose">{step.text}</p>
            </li>
          ))}
        </ol>
      )}
      {usage.steps.length > 1 && hasTitles && (
        <dl className="grid gap-x-6 gap-y-4 md:grid-cols-[minmax(0,14rem)_1fr]">
          {usage.steps.map((step, index) => (
            <UsageStep key={index} step={step} />
          ))}
        </dl>
      )}
      {tailNotes.length > 0 && (
        <div className="flex max-w-prose flex-col gap-2 text-body-sm text-muted-foreground">
          {tailNotes.map((note, index) => (
            <p key={index}>{note}</p>
          ))}
        </div>
      )}
    </div>
  )
}

interface UsageSectionProps {
  id: string
  usage: Usage | null
  pro: Pro | null
  paired?: boolean
}

export function UsageSection({ id, usage, pro, paired = false }: UsageSectionProps) {
  const titleId = useId()
  const showProDescription = hasProDescription(pro)

  return (
    <section id={id} aria-labelledby={titleId} className={`${sectionClass} lg:col-span-7${paired ? ' lg:pt-8' : ''}`}>
      <h2 id={titleId} tabIndex={-1} className={h2Class}>
        {usage?.heading ?? 'Применение'}
      </h2>
      {usage && <UsageBody usage={usage} />}
      {pro?.usage && (
        <div className="flex flex-col gap-6 rounded-block bg-muted p-4 md:p-6">
          <h3 className={h3Class}>Для кабинета · {pro.volumeLabel}</h3>
          <UsageBody usage={pro.usage} />
        </div>
      )}
      {pro && showProDescription && (
        <details className="group border-t border-border pt-6">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            Описание кабинетной фасовки
            <IconChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="flex flex-col gap-8 pt-6">
            {pro.tagline.map((line, index) => (
              <p key={index} className="max-w-prose font-heading text-lead font-semibold leading-snug text-foreground">
                {line}
              </p>
            ))}
            {pro.intro.map((paragraph, index) => (
              <p key={index} className="max-w-prose">
                {paragraph}
              </p>
            ))}
            {pro.howItWorks && <HowItWorksSection data={pro.howItWorks} level="h3" />}
            {pro.forWhom && <ForWhomSection data={pro.forWhom} level="h3" />}
          </div>
        </details>
      )}
    </section>
  )
}
