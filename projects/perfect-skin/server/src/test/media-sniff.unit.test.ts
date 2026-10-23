import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { mkdtemp, open, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  inspectMp4,
  sniffConsentDoc,
  sniffPoster,
  sniffVideo,
  videoCodecFromMoov,
} from '../lib/media-sniff.js'
import { ApiError } from '../lib/errors.js'

function box(type: string, ...parts: Buffer[]): Buffer {
  const body = Buffer.concat(parts)
  const head = Buffer.alloc(8)
  head.writeUInt32BE(8 + body.length, 0)
  head.write(type, 4, 'latin1')
  return Buffer.concat([head, body])
}

function track(handler: string, codec: string): Buffer {
  const hdlr = box('hdlr', Buffer.alloc(8), Buffer.from(handler, 'latin1'), Buffer.alloc(12))
  const stsd = box('stsd', Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]), box(codec, Buffer.alloc(8)))
  return box('trak', box('mdia', hdlr, box('minf', box('stbl', stsd))))
}

const ftyp = box('ftyp', Buffer.from('isom', 'latin1'), Buffer.alloc(4))

describe('sniffVideo', () => {
  it('принимает MP4 по major brand', () => {
    const head = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom', 'latin1'), Buffer.alloc(20)])
    expect(sniffVideo(head)).toBe('mp4')
  })

  it('QuickTime отклоняет с просьбой сохранить как MP4', () => {
    const head = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypqt  ', 'latin1'), Buffer.alloc(20)])
    expect(() => sniffVideo(head)).toThrow('Сохраните ролик как MP4 (H.264)')
  })

  it('принимает WebM по EBML-заголовку и DocType', () => {
    const head = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(20), Buffer.from('webm', 'latin1')])
    expect(sniffVideo(head)).toBe('webm')
  })

  it('отклоняет произвольные байты и PDF', () => {
    expect(() => sniffVideo(Buffer.from('%PDF-1.4 hello world padding padding'))).toThrow(ApiError)
  })
})

describe('sniffPoster и sniffConsentDoc', () => {
  it('постер: только JPEG, WebP и PNG отклоняются', () => {
    expect(sniffPoster(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg')
    expect(() => sniffPoster(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1'))).toThrow('Постер — JPG')
    expect(() => sniffPoster(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toThrow(ApiError)
  })

  it('документ согласия: PDF, JPEG, PNG', () => {
    expect(sniffConsentDoc(Buffer.from('%PDF-1.7', 'latin1'))).toBe('pdf')
    expect(sniffConsentDoc(Buffer.from([0xff, 0xd8, 0xff]))).toBe('jpg')
    expect(sniffConsentDoc(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe('png')
    expect(() => sniffConsentDoc(Buffer.from('GIF89a', 'latin1'))).toThrow(ApiError)
  })
})

describe('videoCodecFromMoov', () => {
  it('берёт кодек видеодорожки и пропускает аудио', () => {
    const moovBody = Buffer.concat([track('soun', 'mp4a'), track('vide', 'avc1')])
    expect(videoCodecFromMoov(moovBody)).toBe('avc1')
  })

  it('возвращает hvc1 для H.265', () => {
    expect(videoCodecFromMoov(track('vide', 'hvc1'))).toBe('hvc1')
  })

  it('без видеодорожки возвращает null', () => {
    expect(videoCodecFromMoov(track('soun', 'mp4a'))).toBeNull()
  })
})

describe('inspectMp4', () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ps-media-sniff-'))
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  async function inspect(name: string, moov: Buffer): Promise<void> {
    const path = join(dir, name)
    const bytes = Buffer.concat([ftyp, box('moov', moov), box('mdat', Buffer.alloc(16))])
    await writeFile(path, bytes)
    const handle = await open(path, 'r')
    try {
      await inspectMp4(handle, bytes.length)
    } finally {
      await handle.close()
    }
  }

  it('пропускает H.264', async () => {
    await expect(inspect('h264.mp4', track('vide', 'avc1'))).resolves.toBeUndefined()
  })

  it('отклоняет H.265 с понятным текстом', async () => {
    await expect(inspect('h265.mp4', track('vide', 'hvc1'))).rejects.toThrow('H.265 не воспроизводится')
  })
})
