import { CareAction } from './CareAction'
import type { CareItem } from './care-data'
import { ROW_NUM } from './classes'

interface CareListProps {
  items: CareItem[]
  size: 'sm' | 'md'
}

export function CareList({ items, size }: CareListProps) {
  const isMd = size === 'md'

  return (
    <ol className="border-t border-border">
      {items.map((item) => (
        <li
          key={item.n}
          className={`grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-border md:grid-cols-[3rem_1fr] md:gap-x-6 ${isMd ? 'py-8' : 'py-6'}`}
        >
          <span className={ROW_NUM}>{item.n}</span>
          <div>
            <h3
              className={`font-heading font-semibold leading-snug normal-case ${isMd ? 'text-xl md:text-2xl' : 'text-lg'}`}
            >
              {item.title}
            </h3>
            <p
              className={
                isMd
                  ? 'mt-2 max-w-prose text-body leading-body text-foreground'
                  : 'mt-1 max-w-[46ch] text-body-sm text-muted-foreground'
              }
            >
              {item.text}
            </p>
            {item.action && (
              <div className={isMd ? 'mt-6' : 'mt-4'}>
                <CareAction action={item.action} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
