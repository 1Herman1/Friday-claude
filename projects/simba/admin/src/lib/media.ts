const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

/**
 * Адрес картинки для показа В АДМИНКЕ.
 *
 * В базе путь хранится так, как его понимает витрина: загруженные файлы —
 * /api/media/..., старые — /pets/... Админка живёт на своём адресе, поэтому
 * без приставки браузер искал бы их у себя и не находил: предпросмотр оставался
 * пустым, а подпись «Предпросмотр» висела над пустотой.
 */
export function imageSrc(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  if (path.startsWith('/api/')) return API_BASE + path
  return path
}

/** Адрес витрины: на проде админка и сайт на одном origin (nginx: / и /admin/), локально — 5173. */
export function siteUrl(): string {
  return import.meta.env.VITE_CLIENT_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:5173')
}
