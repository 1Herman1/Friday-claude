import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LABEL, LINK_MORE } from '@/components/about/classes'

export function MoreLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={`${LINK_MORE} ${className ?? ''}`}>
      {children}
      <span
        aria-hidden="true"
        className="transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
      >
        →
      </span>
    </Link>
  )
}

interface SectionHeaderProps {
  eyebrow: string
  title: string
  titleId: string
  sub: string
  link?: { to: string; text: string }
}

export function SectionHeader({ eyebrow, title, titleId, sub, link }: SectionHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="max-w-[46ch]">
        <p className={`${LABEL} text-primary`}>{eyebrow}</p>
        <h2 id={titleId} className="mt-3 text-h2 [text-wrap:balance]">
          {title}
        </h2>
        <p className="mt-3 text-body text-muted-foreground [text-wrap:pretty]">{sub}</p>
      </div>
      {link && <MoreLink to={link.to}>{link.text}</MoreLink>}
    </div>
  )
}
