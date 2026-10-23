interface PostAdNoteProps {
  isAd: boolean
  advertiser: string | null
  erid: string | null
  className?: string
}

export function PostAdNote({ isAd, advertiser, erid, className }: PostAdNoteProps) {
  if (!isAd) return null
  const parts = ['Реклама', advertiser, erid ? `erid: ${erid}` : null].filter((part): part is string => Boolean(part))
  return <p className={`text-label text-muted-foreground ${className ?? ''}`}>{parts.join(' · ')}</p>
}
