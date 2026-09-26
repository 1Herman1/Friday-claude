import { describe, it, expect } from 'vitest'
import { sniffMime, stripJpegMetadata } from '../lib/pro-docs.js'
import { ApiError } from '../lib/errors.js'

describe('pro-docs', () => {
  describe('sniffMime', () => {
    it('should recognize JPEG by signature', () => {
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
      expect(sniffMime(jpeg)).toBe('image/jpeg')
    })

    it('should recognize PNG by signature', () => {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      expect(sniffMime(png)).toBe('image/png')
    })

    it('should recognize PDF by signature', () => {
      const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
      expect(sniffMime(pdf)).toBe('application/pdf')
    })

    it('should reject SVG (text)', () => {
      const svg = Buffer.from('<?xml version="1.0"?>')
      expect(() => sniffMime(svg)).toThrow(ApiError)
    })

    it('should reject HTML', () => {
      const html = Buffer.from('<!DOCTYPE html>')
      expect(() => sniffMime(html)).toThrow(ApiError)
    })

    it('should reject empty buffer', () => {
      const empty = Buffer.from([])
      expect(() => sniffMime(empty)).toThrow(ApiError)
    })

    it('should reject GIF', () => {
      const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
      expect(() => sniffMime(gif)).toThrow(ApiError)
    })

    it('should reject WebP', () => {
      const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])
      expect(() => sniffMime(webp)).toThrow(ApiError)
    })
  })

  describe('stripJpegMetadata', () => {
    it('should remove APP1 (EXIF) segment from JPEG', () => {
      // Конструируем JPEG: SOI + APP1 + DQT + SOS + данные + EOI
      const soiMarker = Buffer.from([0xff, 0xd8])
      const app1Marker = Buffer.from([0xff, 0xe1])
      const app1Length = Buffer.from([0x00, 0x20]) // 32 байта
      const app1Data = Buffer.alloc(30, 'Exif')
      const dqtMarker = Buffer.from([0xff, 0xdb])
      const dqtLength = Buffer.from([0x00, 0x08])
      const dqtData = Buffer.alloc(6)
      const sosMarker = Buffer.from([0xff, 0xda])
      const sosLength = Buffer.from([0x00, 0x04])
      const sosData = Buffer.alloc(2)
      const scanData = Buffer.from('scan_data')
      const eoiMarker = Buffer.from([0xff, 0xd9])

      const original = Buffer.concat([
        soiMarker,
        app1Marker,
        app1Length,
        app1Data,
        dqtMarker,
        dqtLength,
        dqtData,
        sosMarker,
        sosLength,
        sosData,
        scanData,
        eoiMarker,
      ])

      const stripped = stripJpegMetadata(original)

      // APP1 должен быть удалён
      expect(stripped.includes(app1Marker)).toBe(false)
      // Но SOS, DQT и данные должны остаться
      expect(stripped.includes(sosMarker)).toBe(true)
      expect(stripped.includes(dqtMarker)).toBe(true)
    })

    it('should remove APP13 (IPTC) segment from JPEG', () => {
      const soiMarker = Buffer.from([0xff, 0xd8])
      const app13Marker = Buffer.from([0xff, 0xed])
      const app13Length = Buffer.from([0x00, 0x10])
      const app13Data = Buffer.alloc(14)
      const sosMarker = Buffer.from([0xff, 0xda])
      const sosLength = Buffer.from([0x00, 0x04])
      const sosData = Buffer.alloc(2)
      const scanData = Buffer.from('scan')
      const eoiMarker = Buffer.from([0xff, 0xd9])

      const original = Buffer.concat([
        soiMarker,
        app13Marker,
        app13Length,
        app13Data,
        sosMarker,
        sosLength,
        sosData,
        scanData,
        eoiMarker,
      ])

      const stripped = stripJpegMetadata(original)

      // APP13 должен быть удалён
      expect(stripped.includes(app13Marker)).toBe(false)
      // Но SOS должен остаться
      expect(stripped.includes(sosMarker)).toBe(true)
    })

    it('should preserve non-JPEG formats', () => {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      const stripped = stripJpegMetadata(png)
      expect(stripped).toEqual(png)
    })

    it('should include EOI marker after stripping', () => {
      const soiMarker = Buffer.from([0xff, 0xd8])
      const sosMarker = Buffer.from([0xff, 0xda])
      const sosLength = Buffer.from([0x00, 0x04])
      const sosData = Buffer.alloc(2)
      const scanData = Buffer.from([0x12, 0x34, 0x56, 0x78, 0x9a])
      const eoiMarker = Buffer.from([0xff, 0xd9])

      const original = Buffer.concat([soiMarker, sosMarker, sosLength, sosData, scanData, eoiMarker])
      const stripped = stripJpegMetadata(original)

      // Проверяем, что EOI маркер остался
      expect(stripped[stripped.length - 2]).toBe(0xff)
      expect(stripped[stripped.length - 1]).toBe(0xd9)
    })
  })
})
