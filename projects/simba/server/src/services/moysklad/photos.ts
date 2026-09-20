import { msRequest } from './client.js'

/** Одна картинка товара в МоемСкладе. */
export type MsImage = {
  filename?: string
  miniature?: { downloadHref?: string }
  meta?: { downloadHref?: string }
}

type MsImagesResponse = { rows: MsImage[] }

/**
 * Расширение по типу файла, а не по имени из МоегоСклада: имена там бывают
 * вида «IMG_0421» без расширения вовсе, а хранилище кладёт файл по типу.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

export function mimeFromFilename(filename: string | undefined): string | null {
  const ext = (filename ?? '').toLowerCase().split('.').pop()
  return ext ? MIME_BY_EXTENSION[ext] ?? null : null
}

/**
 * Ссылка на файл в полном размере. `miniature` — это превью размером с ноготь,
 * его брать нельзя: на карточке товара оно расплывётся.
 */
export function fullSizeHref(image: MsImage): string | null {
  return image.meta?.downloadHref ?? null
}

/** Список картинок товара. Возвращает пустой массив, если их нет. */
export async function fetchProductImages(moyskladProductId: string): Promise<MsImage[]> {
  const res = await msRequest<MsImagesResponse>(`/entity/product/${moyskladProductId}/images`)
  return res.rows ?? []
}

/**
 * Скачивает файл картинки. Ссылка из МоегоСклада требует того же токена, что и
 * остальное API, — открыть её прямо на витрине нельзя, поэтому файл забираем
 * себе и раздаём со своего адреса.
 */
export async function downloadImage(
  href: string,
  filename?: string
): Promise<{ buffer: Buffer; mimetype: string } | null> {
  const token = process.env.MOYSKLAD_TOKEN
  if (!token) {
    throw new Error('Не задана переменная MOYSKLAD_TOKEN')
  }

  const res = await fetch(href, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'follow',
  })

  if (!res.ok) return null

  // МойСклад часто отдаёт файл как application/octet-stream, поэтому тип берём
  // из заголовка только если он осмысленный, иначе — по расширению имени.
  const fromHeader = res.headers.get('content-type')?.split(';')[0]?.trim()
  const mimetype =
    fromHeader && Object.values(MIME_BY_EXTENSION).includes(fromHeader)
      ? fromHeader
      : mimeFromFilename(filename)

  if (!mimetype) return null

  return { buffer: Buffer.from(await res.arrayBuffer()), mimetype }
}
