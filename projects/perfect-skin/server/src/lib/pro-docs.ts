import { createHash } from 'crypto'
import { mkdir, writeFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'
import { ApiError } from './errors.js'

export type SupportedMime = 'image/jpeg' | 'image/png' | 'application/pdf'

/**
 * Определяет MIME-тип по сигнатуре байтов.
 * JPEG: FF D8 FF
 * PNG: 89 50 4E 47 0D 0A 1A 0A
 * PDF: 25 50 44 46 2D ('%PDF-')
 * Всё остальное: не поддерживается.
 */
export function sniffMime(buf: Buffer): SupportedMime {
  if (buf.length === 0) {
    throw new ApiError(400, 'UNSUPPORTED_FILE', 'Нужен JPG, PNG или PDF')
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg'
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png'
  }

  // PDF: 25 50 44 46 2D ('%PDF-')
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d) {
    return 'application/pdf'
  }

  throw new ApiError(400, 'UNSUPPORTED_FILE', 'Нужен JPG, PNG или PDF')
}

/**
 * Удаляет JPEG APP1 (EXIF/XMP) и APP13 (IPTC) сегменты.
 * Для PNG и PDF возвращает буфер как есть.
 *
 * JPEG структура:
 * - SOI (Start Of Image): FF D8
 * - Маркеры: FF XX [length] [data]
 *   - FFE1 (APP1), FFED (APP13) — удаляются
 *   - Другие маркеры пропускаются
 * - SOS (Start Of Scan): FF DA
 * - Scan data
 * - EOI (End Of Image): FF D9
 */
export function stripJpegMetadata(buf: Buffer): Buffer {
  // Проверяем, что это JPEG
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
    return buf
  }

  const result: Buffer[] = []
  result.push(buf.slice(0, 2)) // SOI (FF D8)

  let pos = 2
  while (pos < buf.length) {
    // Ищем маркер FF
    if (buf[pos] !== 0xff) {
      pos++
      continue
    }

    const marker = buf[pos + 1]

    // SOS (FF DA) — начало данных, копируем всё до конца
    if (marker === 0xda) {
      result.push(buf.slice(pos))
      break
    }

    // EOI (FF D9) — конец файла
    if (marker === 0xd9) {
      result.push(buf.slice(pos))
      break
    }

    // RSTn (FF D0-D7) и SOI, EOI не имеют length
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0xd8 || marker === 0xd9) {
      result.push(buf.slice(pos, pos + 2))
      pos += 2
      continue
    }

    // Получаем длину сегмента (big-endian, включает сами 2 байта длины)
    if (pos + 3 >= buf.length) break
    const length = buf.readUInt16BE(pos + 2)

    // APP1 (FFE1) и APP13 (FFED) — удаляем
    if (marker === 0xe1 || marker === 0xed) {
      pos += length + 2
      continue
    }

    // Остальные сегменты копируем
    result.push(buf.slice(pos, pos + length + 2))
    pos += length + 2
  }

  return Buffer.concat(result)
}

/**
 * Вычисляет SHA256 хеш буфера.
 */
export function hashBuffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

/**
 * Сохраняет файл в каталог PS_PRO_DOCS_DIR.
 * Имя файла — UUID без расширения.
 * Права: 0700 на каталог, 0600 на файлы.
 */
export async function saveProDocument(
  storageDir: string,
  buf: Buffer,
  mime: SupportedMime
): Promise<string> {
  // Убедимся, что каталог существует и имеет правильные права
  if (!existsSync(storageDir)) {
    await mkdir(storageDir, { recursive: true, mode: 0o700 })
  }

  const key = randomUUID()
  const filePath = join(storageDir, key)

  await writeFile(filePath, buf, { mode: 0o600 })
  return key
}

/**
 * Удаляет файл по ключу. ENOENT (файл не существует) — не ошибка.
 */
export async function deleteStoredFile(storageDir: string, key: string): Promise<void> {
  const filePath = join(storageDir, key)
  try {
    await unlink(filePath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err
    }
    // ENOENT — файл уже удалён, это OK
  }
}

/**
 * Читает файл из хранилища.
 */
export async function readStoredFile(storageDir: string, key: string): Promise<Buffer> {
  const filePath = join(storageDir, key)
  try {
    const buf = await import('fs/promises').then(m => m.readFile(filePath))
    return buf
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Документ удалён по сроку хранения или не загружался')
    }
    throw err
  }
}
