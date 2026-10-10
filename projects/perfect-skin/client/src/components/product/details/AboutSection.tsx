import { useId } from 'react'
import type { Extra } from '@/types/api'
import { h2Class, h3Class, sectionClass } from './classes'

interface AboutSectionProps {
  id: string
  tagline: string[]
  intro: string[]
  extra: Extra[]
}

export function AboutSection({ id, tagline, intro, extra }: AboutSectionProps) {
  const titleId = useId()

  return (
    <section id={id} aria-labelledby={titleId} className={sectionClass}>
      <h2 id={titleId} tabIndex={-1} className={h2Class}>
        О средстве
      </h2>
      {tagline.map((line, index) => (
        <p key={index} className="max-w-prose font-heading text-lead font-semibold leading-snug text-foreground">
          {line}
        </p>
      ))}
      {intro.length > 0 && (
        <div className="flex max-w-prose flex-col gap-4">
          {intro.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      )}
      {extra.map((block, index) => (
        <div key={index} className="flex max-w-prose flex-col gap-4">
          <h3 className={h3Class}>{block.heading}</h3>
          {block.paragraphs.map((paragraph, paragraphIndex) => (
            <p key={paragraphIndex}>{paragraph}</p>
          ))}
          {block.items.length > 0 && (
            <ul role="list" className="list-disc space-y-2 pl-6 marker:text-primary">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  )
}
