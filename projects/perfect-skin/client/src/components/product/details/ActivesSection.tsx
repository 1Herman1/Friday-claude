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
}

const CONCENTRATION = /(\d+(?:[.,]\d+)?\s?%)/
const NOTE = /^(.*?)\s*\(([^()]+)\)$/
const COLON = /^([^:]{2,60}):\s*(.+)$/

interface ActiveView {
  name: string
  note: string | null
  concentration: string | null
}

function parseActive(text: string): ActiveView {
  const colon = text.match(COLON)
  const head = colon ? colon[1] : text
  const concentration = head.match(CONCENTRATION)?.[1] ?? null
  const rest = head
    .replace(CONCENTRATION, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,;:–—-]+$/u, '')
    .trim()
  const base = rest || head.trim()
  if (colon) return { name: base, note: colon[2].trim(), concentration }
  const note = base.match(NOTE)
  return note
    ? { name: note[1].trim(), note: note[2].trim(), concentration }
    : { name: base, note: null, concentration }
}

function visibleActives(actives: string[]): ActiveView[] {
  const rows = actives.map(parseActive)
  const described = new Set(rows.filter(row => row.note !== null).map(row => row.name.toLowerCase()))
  return rows.filter(row => row.note !== null || !described.has(row.name.toLowerCase()))
}

interface ActivesSectionProps {
  id: string
  actives: string[]
}

export function ActivesSection({ id, actives }: ActivesSectionProps) {
  const titleId = useId()
  const rows = visibleActives(actives)
  const half = Math.ceil(rows.length / 2)
  const columns = [rows.slice(0, half), rows.slice(half)].filter(column => column.length > 0)

  return (
    <section id={id} aria-labelledby={titleId} className={sectionClass}>
      <h2 id={titleId} tabIndex={-1} className={h2Class}>
        Активные компоненты
      </h2>
      <div className="md:grid md:grid-cols-2 md:gap-x-12">
        {columns.map((column, columnIndex) => (
          <ul
            key={columnIndex}
            role="list"
            className={`divide-y divide-border${columnIndex > 0 ? ' border-t border-border md:border-t-0' : ''}`}
          >
            {column.map((row, index) => {
              const Icon = ICONS[ingredientIcon(row.name)]
              return (
                <li key={index} className="flex gap-4 py-4">
                  <Icon className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 break-words hyphens-auto font-semibold text-foreground">{row.name}</span>
                      {row.concentration && (
                        <span className="shrink-0 font-heading text-h3 font-bold leading-none tabular-nums text-foreground">
                          {row.concentration}
                        </span>
                      )}
                    </div>
                    {row.note && <p className="min-w-0 break-words hyphens-auto text-body-sm text-muted-foreground">{row.note}</p>}
                  </div>
                </li>
              )
            })}
          </ul>
        ))}
      </div>
    </section>
  )
}
