import { Link } from 'react-router-dom'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Хлебные крошки" className="mb-4">
      <ol className="flex items-center gap-2 text-sm text-muted-foreground">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-center gap-2">
            {item.href ? (
              <Link
                to={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground">{item.label}</span>
            )}
            {idx < items.length - 1 && <span className="text-muted-foreground">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}
