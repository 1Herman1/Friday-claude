import { useId } from 'react'
import { IconLightbulb } from '../../icons'
import type { Lifehack } from '@/types/api'
import { scrollMt } from './classes'

interface LifehackBannerProps {
  id: string
  data: Lifehack
}

export function LifehackBanner({ id, data }: LifehackBannerProps) {
  const titleId = useId()
  // Подпись «Лайфхак» уже над баннером — из заголовка клиента убираем повтор этого слова
  const rest = data.title?.replace(/^(лайф|лайв)[\s-]*хак\s*(от экспертов)?[\s:.\-–—]*/i, '').trim()
  const title = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : null

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={`${scrollMt} flex flex-col gap-4 rounded-block bg-dark p-6 text-dark-foreground md:p-12`}
    >
      <div className="flex items-center gap-3">
        <IconLightbulb className="h-5 w-5 shrink-0 text-accent" />
        <h2 id={titleId} tabIndex={-1} className="font-sans text-label font-semibold uppercase tracking-wide text-accent">
          Лайфхак
        </h2>
      </div>
      {title && (
        <h3 className="font-heading text-lg font-semibold text-dark-foreground md:text-xl">{title}</h3>
      )}
      {data.paragraphs.map((paragraph, index) => (
        <p key={index} className="max-w-prose">
          {paragraph}
        </p>
      ))}
    </section>
  )
}
