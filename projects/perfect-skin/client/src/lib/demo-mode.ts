/** Демо видеоотзывов главной: `?demo=sections`. В проде включает только видеоотзывы, статьи и новости — только dev */
export function isDemoSections(): boolean {
  return new URLSearchParams(window.location.search).get('demo') === 'sections'
}

export function hasDemoParam(): boolean {
  return new URLSearchParams(window.location.search).has('demo')
}

/** Макет видеоотзывов в сборке: `VITE_DEMO_VIDEO_REVIEWS=1`. Выключить перед запуском на домене */
export function isDemoVideoReviewsBuild(): boolean {
  return import.meta.env.VITE_DEMO_VIDEO_REVIEWS === '1'
}
