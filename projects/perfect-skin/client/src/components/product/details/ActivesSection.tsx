import { useId, type ComponentType } from 'react'
import { ingredientIcon, type IngredientIconName } from '@/lib/ingredient-icon'
import {
  IconAtom,
  IconCitrus,
  IconDna,
  IconDroplet,
  IconDroplets,
  IconFlaskConical,
  IconFlower2,
  IconGem,
  IconGrape,
  IconHexagon,
  IconLeaf,
  IconSparkles,
  IconSun,
  IconWaves,
  IconWheat,
  IconWind,
  type IconProps,
} from '../../icons'
import { h2Class, sectionClass } from './classes'

const ICONS: Record<IngredientIconName, ComponentType<IconProps>> = {
  Dna: IconDna,
  Droplet: IconDroplet,
  Waves: IconWaves,
  Droplets: IconDroplets,
  FlaskConical: IconFlaskConical,
  Wind: IconWind,
  Citrus: IconCitrus,
  Sun: IconSun,
  Hexagon: IconHexagon,
  Leaf: IconLeaf,
  Flower2: IconFlower2,
  Grape: IconGrape,
  Wheat: IconWheat,
  Gem: IconGem,
  Atom: IconAtom,
  Sparkles: IconSparkles,
}

const CONCENTRATION = /(\d+(?:[.,]\d+)?\s?%)/
const NOTE = /^(.*?)\s*\(([^()]+)\)$/

interface ActiveView {
  name: string
  note: string | null
  concentration: string | null
}

function parseActive(text: string): ActiveView {
  const concentration = text.match(CONCENTRATION)?.[1] ?? null
  const rest = text
    .replace(CONCENTRATION, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,;:–—-]+$/u, '')
    .trim()
  const base = rest || text
  const note = base.match(NOTE)
  return note
    ? { name: note[1].trim(), note: note[2].trim(), concentration }
    : { name: base, note: null, concentration }
}

interface ActivesSectionProps {
  id: string
  actives: string[]
}

export function ActivesSection({ id, actives }: ActivesSectionProps) {
  const titleId = useId()

  return (
    <section id={id} aria-labelledby={titleId} className={sectionClass}>
      <h2 id={titleId} tabIndex={-1} className={h2Class}>
        Активные компоненты
      </h2>
      <ul role="list" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {actives.map((text, index) => {
          const active = parseActive(text)
          const Icon = ICONS[ingredientIcon(active.name)]
          return (
            <li
              key={index}
              className={`flex flex-col gap-3 rounded-block p-4 md:p-6 ${index % 2 === 0 ? 'bg-card' : 'bg-muted'}`}
            >
              <Icon className="h-5 w-5 text-primary" />
              {active.concentration && (
                <span className="font-heading text-h3 font-bold leading-none tabular-nums text-foreground">
                  {active.concentration}
                </span>
              )}
              <span className="text-body-sm font-semibold text-foreground">{active.name}</span>
              {active.note && <span className="text-body-sm text-muted-foreground">{active.note}</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
