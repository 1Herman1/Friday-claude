import type { ProductDetails } from '@/types/api'
import { AboutSection } from './AboutSection'
import { ActivesSection } from './ActivesSection'
import { ForWhomSection } from './ForWhomSection'
import { HowItWorksSection } from './HowItWorksSection'
import { InciSection } from './InciSection'
import { LifehackBanner } from './LifehackBanner'
import { SectionChips } from './SectionChips'
import { UsageSection, hasUsageBlock } from './UsageSection'

interface ProductCareCardProps {
  details: ProductDetails
  inciText: string | null
}

export function ProductCareCard({ details, inciText }: ProductCareCardProps) {
  const hasAbout = details.tagline.length + details.intro.length + details.extra.length > 0
  const hasActives = details.actives.length > 0
  const hasUsage = hasUsageBlock(details.usage, details.pro)
  const lifehack = details.lifehack
  const hasLifehack = lifehack !== null && (Boolean(lifehack.title) || lifehack.paragraphs.length > 0)
  const hasInci = Boolean(inciText)
  const sidePair = details.forWhom !== null && hasUsage

  const chips = [
    { id: 'pd-about', label: 'О средстве', visible: hasAbout },
    { id: 'pd-how', label: 'Как работает', visible: details.howItWorks !== null },
    { id: 'pd-actives', label: 'Активы', visible: hasActives },
    { id: 'pd-for', label: 'Кому', visible: details.forWhom !== null },
    { id: 'pd-usage', label: 'Применение', visible: hasUsage },
    { id: 'pd-tip', label: 'Лайфхак', visible: hasLifehack },
    { id: 'pd-inci', label: 'INCI', visible: hasInci },
  ]
    .filter(chip => chip.visible)
    .map(({ id, label }) => ({ id, label }))

  if (chips.length === 0) return null

  return (
    <section aria-labelledby="pd-card-label" className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p id="pd-card-label" className="text-label font-semibold uppercase tracking-wide text-primary">
          Аптечная карта
        </p>
        <SectionChips items={chips} />
      </div>

      <div className="flex flex-col gap-12 md:gap-20">
        {hasAbout && (
          <AboutSection id="pd-about" tagline={details.tagline} intro={details.intro} extra={details.extra} />
        )}
        {details.howItWorks && <HowItWorksSection id="pd-how" data={details.howItWorks} />}
        {hasActives && <ActivesSection id="pd-actives" actives={details.actives} />}
        {(details.forWhom !== null || hasUsage) && (
          <div className={`flex flex-col gap-12 ${sidePair ? 'lg:grid lg:grid-cols-12 lg:gap-x-16' : ''}`}>
            {details.forWhom && <ForWhomSection id="pd-for" data={details.forWhom} />}
            {hasUsage && <UsageSection id="pd-usage" usage={details.usage} pro={details.pro} />}
          </div>
        )}
        {hasLifehack && lifehack && <LifehackBanner id="pd-tip" data={lifehack} />}
        <InciSection id="pd-inci" text={inciText} />
      </div>
    </section>
  )
}
