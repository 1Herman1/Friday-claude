interface PostAdNoteProps {
  isAd: boolean
  advertiser: string | null
  erid: string | null
  className?: string
  tone?: string
}

export function PostAdNote({ isAd, advertiser, erid, className, tone = 'text-muted-foreground' }: PostAdNoteProps) {
  if (!isAd) return null
  const parts = ['Реклама', advertiser, erid ? `erid: ${erid}` : null].filter((part): part is string => Boolean(part))
  return <p className={`text-label ${tone} ${className ?? ''}`}>{parts.join(' · ')}</p>
}
