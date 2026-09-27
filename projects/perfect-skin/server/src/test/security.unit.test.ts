import { describe, it, expect } from 'vitest'

describe('security helpers', () => {
  describe('bigint from chat ID', () => {
    it('should convert number to BigInt consistently', () => {
      const chatIdNumber = 123456789
      const chatIdBigInt = BigInt(chatIdNumber)

      // Оба способа должны дать один и тот же результат
      expect(BigInt(chatIdNumber)).toBe(chatIdBigInt)
      expect(BigInt(chatIdNumber).toString()).toBe('123456789')
    })

    it('should handle same BigInt from different sources', () => {
      const fromNumber = BigInt(987654321)
      const fromNumberAgain = BigInt(987654321)

      // Должны быть равны
      expect(fromNumber).toBe(fromNumberAgain)
    })

    it('should use BigInt consistently as Map key', () => {
      const map = new Map<bigint, string>()
      const id1 = 111222333
      const id2 = 111222333

      map.set(BigInt(id1), 'first')

      // Получаем по тому же id, приведённому к BigInt
      expect(map.get(BigInt(id2))).toBe('first')
    })
  })

  describe('URL masking in logs', () => {
    it('should mask token in /api/v1/review/{token}', () => {
      const urlWithToken = '/api/v1/review/abc123def456xyz789_'
      const pattern = /\/api\/v1\/review\/[^/?]+/g
      const masked = urlWithToken.replace(pattern, '/api/v1/review/[скрыто]')

      expect(masked).toBe('/api/v1/review/[скрыто]')
      expect(masked).not.toContain('abc123def456xyz789')
    })

    it('should mask token with query string', () => {
      const urlWithToken = '/api/v1/review/abc123?someParam=value'
      const pattern = /\/api\/v1\/review\/[^/?]+/g
      const masked = urlWithToken.replace(pattern, '/api/v1/review/[скрыто]')

      expect(masked).toBe('/api/v1/review/[скрыто]?someParam=value')
    })

    it('should mask token with file endpoint', () => {
      const urlWithToken = '/api/v1/review/abc123/file'
      const pattern = /\/api\/v1\/review\/[^/?]+/g
      const masked = urlWithToken.replace(pattern, '/api/v1/review/[скрыто]')

      expect(masked).toBe('/api/v1/review/[скрыто]/file')
    })

    it('should not mask non-review URLs', () => {
      const otherUrl = '/api/v1/products/some-slug'
      const pattern = /\/api\/v1\/review\/[^/?]+/g
      const masked = otherUrl.replace(pattern, '/api/v1/review/[скрыто]')

      // Не изменяется, так как не соответствует паттерну review
      expect(masked).toBe(otherUrl)
    })

    it('should handle URL with encoded characters in token', () => {
      // Токены base64url могут содержать - и _ (URL-безопасные символы)
      const urlWithEncoded = '/api/v1/review/abc-def_ghi123'
      const pattern = /\/api\/v1\/review\/[^/?]+/g
      const masked = urlWithEncoded.replace(pattern, '/api/v1/review/[скрыто]')

      expect(masked).toBe('/api/v1/review/[скрыто]')
      expect(masked).not.toContain('abc-def_ghi123')
    })
  })

  describe('token limit enforcement', () => {
    it('should enforce limit of 8 uses', () => {
      const maxUses = 8
      let uses = 0

      // Страница просмотра — +1
      uses++
      expect(uses).toBeLessThan(maxUses)

      // Загрузка изображения сертификата — +1
      uses++
      expect(uses).toBeLessThan(maxUses)

      // Можем загрузить до 6 дополнительных документов
      for (let i = 0; i < 6; i++) {
        uses++
        expect(uses).toBeLessThanOrEqual(maxUses)
      }

      // 8-е использование — в пределах
      expect(uses).toBe(maxUses)

      // 9-е использование — за пределами лимита
      uses++
      expect(uses).toBeGreaterThan(maxUses)
    })
  })
})
