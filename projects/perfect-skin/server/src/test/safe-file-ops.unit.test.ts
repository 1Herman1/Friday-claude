import { describe, it, expect } from 'vitest'
import { isFileSafeToDelete } from '../lib/safe-file-ops.js'

describe('Safe File Operations', () => {
  const allowedDir = '/var/www/perfect-skin/uploads/products'

  describe('isFileSafeToDelete', () => {
    it('should allow simple filename', () => {
      expect(isFileSafeToDelete('uuid-123.jpg', allowedDir)).toBe(true)
    })

    it('should allow filename with numbers', () => {
      expect(isFileSafeToDelete('12345678-1234-5678-1234-567812345678.png', allowedDir)).toBe(true)
    })

    it('should allow filename with dashes and dots', () => {
      expect(isFileSafeToDelete('my-image-file.jpg', allowedDir)).toBe(true)
    })

    it('should reject filename with directory traversal ..', () => {
      expect(isFileSafeToDelete('../etc/passwd', allowedDir)).toBe(false)
    })

    it('should reject filename with directory traversal ../../', () => {
      expect(isFileSafeToDelete('../../etc/shadow', allowedDir)).toBe(false)
    })

    it('should reject filename with absolute path', () => {
      expect(isFileSafeToDelete('/etc/passwd', allowedDir)).toBe(false)
    })

    it('should reject filename with forward slash in middle', () => {
      expect(isFileSafeToDelete('subdir/file.jpg', allowedDir)).toBe(false)
    })

    it('should reject filename with backslash', () => {
      expect(isFileSafeToDelete('..\\windows\\system32', allowedDir)).toBe(false)
    })

    it('should reject empty filename', () => {
      expect(isFileSafeToDelete('', allowedDir)).toBe(false)
    })

    it('should reject empty directory', () => {
      expect(isFileSafeToDelete('file.jpg', '')).toBe(false)
    })

    it('should reject null values', () => {
      expect(isFileSafeToDelete(null as any, allowedDir)).toBe(false)
      expect(isFileSafeToDelete('file.jpg', null as any)).toBe(false)
    })

    it('should reject double dots at start', () => {
      expect(isFileSafeToDelete('..file.jpg', allowedDir)).toBe(false)
    })

    it('should reject filename that is just dots', () => {
      expect(isFileSafeToDelete('..', allowedDir)).toBe(false)
    })

    it('should allow filename with underscore', () => {
      expect(isFileSafeToDelete('my_file_name.jpg', allowedDir)).toBe(true)
    })

    it('should reject URL encoded traversal', () => {
      expect(isFileSafeToDelete('%2e%2e/etc/passwd', allowedDir)).toBe(false)
    })
  })
})
