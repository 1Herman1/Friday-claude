import { ApiError } from '@/lib/api'

const MISSING_LABELS: Record<string, string> = {
  mp4: 'ролик MP4',
  poster: 'постер',
  consent: 'согласие человека в кадре',
  consentDoc: 'документ согласия',
  site: 'разрешение на показ на сайте',
  review: 'проверка содержания',
  revoked: 'согласие отозвано',
  expired: 'срок согласия истёк',
}

/** Текст для 409 VIDEO_NOT_READY: чего не хватает для публикации. Для других ошибок — null */
export function describeNotReady(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code !== 'VIDEO_NOT_READY') return null
  const missing = error.details?.missing
  const keys = Array.isArray(missing) ? missing.filter((key): key is string => typeof key === 'string') : []
  const labels = keys.map((key) => MISSING_LABELS[key] ?? key)
  return `Нельзя опубликовать: ${labels.join(', ') || 'не все условия выполнены'}.`
}
