import { useEffect, useState, type MouseEvent } from 'react'

export interface ChipItem {
  id: string
  label: string
}

interface SectionChipsProps {
  items: ChipItem[]
}

function currentSection(sections: HTMLElement[]): string | null {
  const line = window.innerHeight * 0.4
  let current: string | null = null
  for (const section of sections) {
    const rect = section.getBoundingClientRect()
    if (rect.top > line) break
    if (rect.bottom > line) return section.id
    current = section.id
  }
  return current
}

export function SectionChips({ items }: SectionChipsProps) {
  const [active, setActive] = useState<string | null>(null)
  const idsKey = items.map(item => item.id).join(' ')

  useEffect(() => {
    const sections = idsKey
      .split(' ')
      .map(id => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null)
    let frame: number | null = null
    const update = () => {
      frame = null
      setActive(currentSection(sections))
    }
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [idsKey])

  if (items.length === 0) return null

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const section = document.getElementById(id)
    if (!section) return
    event.preventDefault()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    history.replaceState(history.state, '', `#${id}`)
    setActive(id)
    section.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
  }

  return (
    <nav
      aria-label="Разделы карточки"
      className="-mx-6 overflow-x-auto px-6 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <ul role="list" className="flex w-max gap-2 md:w-auto md:flex-wrap">
        {items.map(item => {
          const isActive = item.id === active
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={event => handleClick(event, item.id)}
                aria-current={isActive ? 'location' : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center rounded-pill border px-4 text-body-sm font-semibold transition-transform duration-160 active:scale-97 motion-reduce:transition-none motion-reduce:active:scale-100 ${
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border-strong text-foreground hover:border-primary'
                }`}
              >
                {item.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
