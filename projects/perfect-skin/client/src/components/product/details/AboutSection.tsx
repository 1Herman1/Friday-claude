import { useId } from 'react'
import type { Extra } from '@/types/api'
import { h2Class, h3Class, sectionClass } from './classes'

interface AboutSectionProps {
  id: string
  tagline: string[]
  intro: string[]
  extra: Extra[]
}

function IntroParagraphs({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="flex max-w-prose flex-col gap-4">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  )
}

function ExtraBlocks({ extra }: { extra: Extra[] }) {
  return (
    <>
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
    </>
  )
}

export function AboutSection({ id, tagline, intro, extra }: AboutSectionProps) {
  const titleId = useId()
  const leadIntro = intro.slice(0, 1)
  const restIntro = intro.slice(1)
  const hasBody = intro.length > 0 || extra.length > 0
  const hasMore = restIntro.length > 0 || extra.length > 0

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
      {hasBody && (
        <>
          <div className="flex flex-col gap-6 md:hidden">
            <IntroParagraphs paragraphs={leadIntro} />
            {hasMore && (
              <details className="group">
                <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Читать полностью</span>
                  <span className="hidden group-open:inline">Свернуть</span>
                </summary>
                <div className="flex flex-col gap-6 pt-4 group-open:animate-[fadeIn_200ms_ease-out] motion-reduce:animate-none">
                  {restIntro.length > 0 && <IntroParagraphs paragraphs={restIntro} />}
                  <ExtraBlocks extra={extra} />
                </div>
              </details>
            )}
          </div>
          <div className="hidden flex-col gap-6 md:flex">
            <IntroParagraphs paragraphs={intro} />
            <ExtraBlocks extra={extra} />
          </div>
        </>
      )}
    </section>
  )
}
