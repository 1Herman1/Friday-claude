interface NoImageProps {
  className?: string
  text?: string
  aspectRatio?: string
  tone?: 'light' | 'dark'
}

// Тёмный тон живёт внутри секции с фоном bg-dark, поэтому сам фон заглушки —
// полупрозрачный светлый, как у соседних карточек и скелетонов: иначе блок
// сливается с секцией и «Нет изображения» повисает в пустоте.
const TONE_CLASSES = {
  light: 'bg-muted text-muted-foreground',
  dark: 'bg-dark-foreground/10 text-dark-foreground/70',
} as const

export function NoImage({
  className,
  text = 'Нет изображения',
  aspectRatio = 'aspect-[3/4]',
  tone = 'light',
}: NoImageProps) {
  return (
    <div
      className={`w-full ${aspectRatio} flex items-center justify-center rounded-media ${TONE_CLASSES[tone]} ${className ?? ''}`}
      role="img"
      aria-label={text}
    >
      {text}
    </div>
  )
}
