import type { FileHandle } from 'node:fs/promises'
import { ApiError } from './errors.js'

export type VideoExt = 'mp4' | 'webm'
export type ConsentDocExt = 'pdf' | 'jpg' | 'png'

const MP4_BRANDS = ['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'dash', 'MSNV']
const HEVC_CODECS = ['hvc1', 'hev1']
const EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3])
const MOOV_LIMIT = 8 * 1024 * 1024

interface Box {
  type: string
  bodyStart: number
  end: number
}

// Сигнатуры смотрим по первым байтам: тип файла определяется содержимым, а не расширением.
export function sniffVideo(head: Buffer): VideoExt {
  if (head.length >= 12 && head.toString('latin1', 4, 8) === 'ftyp') {
    const brand = head.toString('latin1', 8, 12)
    if (brand === 'qt  ') {
      throw new ApiError(400, 'UNSUPPORTED_FILE', 'Сохраните ролик как MP4 (H.264)')
    }
    if (MP4_BRANDS.includes(brand)) return 'mp4'
  }
  if (head.subarray(0, 4).equals(EBML_MAGIC) && head.subarray(0, 64).includes('webm', 0, 'latin1')) {
    return 'webm'
  }
  throw new ApiError(400, 'UNSUPPORTED_FILE', 'Нужен ролик в формате MP4 (H.264) или WebM')
}

export function sniffPoster(head: Buffer): 'jpg' {
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpg'
  throw new ApiError(400, 'UNSUPPORTED_FILE', 'Постер — JPG')
}

export function sniffConsentDoc(head: Buffer): ConsentDocExt {
  if (head.toString('latin1', 0, 5) === '%PDF-') return 'pdf'
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpg'
  if (head[0] === 0x89 && head.toString('latin1', 1, 4) === 'PNG') return 'png'
  throw new ApiError(400, 'UNSUPPORTED_FILE', 'Документ — PDF, JPG или PNG')
}

function boxesIn(buf: Buffer, start: number, end: number): Box[] {
  const boxes: Box[] = []
  let pos = start
  while (pos + 8 <= end) {
    let size = buf.readUInt32BE(pos)
    const type = buf.toString('latin1', pos + 4, pos + 8)
    let header = 8
    if (size === 1) {
      if (pos + 16 > end) break
      size = Number(buf.readBigUInt64BE(pos + 8))
      header = 16
    } else if (size === 0) {
      size = end - pos
    }
    if (size < header || pos + size > end) break
    boxes.push({ type, bodyStart: pos + header, end: pos + size })
    pos += size
  }
  return boxes
}

function findBox(buf: Buffer, parent: { bodyStart: number; end: number }, type: string): Box | undefined {
  return boxesIn(buf, parent.bodyStart, parent.end).find((box) => box.type === type)
}

// Код видеодорожки из stsd: первая запись описания образца, её fourcc (avc1, hvc1, ...).
function videoCodecOfTrack(buf: Buffer, trak: Box): string | null {
  const mdia = findBox(buf, trak, 'mdia')
  const hdlr = mdia && findBox(buf, mdia, 'hdlr')
  if (!mdia || !hdlr || buf.toString('latin1', hdlr.bodyStart + 8, hdlr.bodyStart + 12) !== 'vide') return null
  const minf = findBox(buf, mdia, 'minf')
  const stbl = minf && findBox(buf, minf, 'stbl')
  const stsd = stbl && findBox(buf, stbl, 'stsd')
  if (!stsd) return null
  // stsd: version+flags (4), entry_count (4), затем size (4) и fourcc (4) первой записи
  return buf.toString('latin1', stsd.bodyStart + 12, stsd.bodyStart + 16)
}

/** Кодек видеодорожки по телу moov (без заголовка бокса). */
export function videoCodecFromMoov(moovBody: Buffer): string | null {
  for (const trak of boxesIn(moovBody, 0, moovBody.length).filter((box) => box.type === 'trak')) {
    const codec = videoCodecOfTrack(moovBody, trak)
    if (codec) return codec
  }
  return null
}

/** Читает top-level боксы по заголовкам, moov — целиком (не больше 8 МБ). Бросает 400, если кодек H.265. */
export async function inspectMp4(file: FileHandle, size: number): Promise<void> {
  let pos = 0
  while (pos + 8 <= size) {
    const head = Buffer.alloc(16)
    const { bytesRead } = await file.read(head, 0, 16, pos)
    if (bytesRead < 8) break
    let boxSize = head.readUInt32BE(0)
    const type = head.toString('latin1', 4, 8)
    let header = 8
    if (boxSize === 1) {
      if (bytesRead < 16) break
      boxSize = Number(head.readBigUInt64BE(8))
      header = 16
    } else if (boxSize === 0) {
      boxSize = size - pos
    }
    if (boxSize < header) break

    if (type === 'moov') {
      const bodySize = boxSize - header
      if (bodySize > MOOV_LIMIT) {
        throw new ApiError(400, 'UNSUPPORTED_FILE', 'Структура ролика нестандартна: сохраните его заново как MP4 (H.264)')
      }
      const body = Buffer.alloc(bodySize)
      await file.read(body, 0, bodySize, pos + header)
      const codec = videoCodecFromMoov(body)
      if (codec && HEVC_CODECS.includes(codec)) {
        throw new ApiError(400, 'UNSUPPORTED_FILE', 'H.265 не воспроизводится в части браузеров, сохраните в H.264')
      }
      return
    }
    pos += boxSize
  }
  throw new ApiError(400, 'UNSUPPORTED_FILE', 'Не удалось прочитать ролик. Сохраните его как MP4 (H.264)')
}
