import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const productSchema = z.object({
  name: z.string().min(1).max(200),
  shortDescription: z.string().max(500).optional(),
  description: z.string().min(1).max(20000),
  usage: z.string().max(10000).optional(),
  inciText: z.string().max(10000).optional(),
  seoTitle: z.string().max(300).optional(),
  seoDescription: z.string().max(300).optional(),
})

describe('Product Field Lengths', () => {
  describe('name', () => {
    it('should accept name within limit', () => {
      const result = productSchema.safeParse({
        name: 'My Product',
        description: 'Description',
      })
      expect(result.success).toBe(true)
    })

    it('should accept name at limit (200)', () => {
      const name = 'a'.repeat(200)
      const result = productSchema.safeParse({
        name,
        description: 'Description',
      })
      expect(result.success).toBe(true)
    })

    it('should reject name exceeding limit', () => {
      const name = 'a'.repeat(201)
      const result = productSchema.safeParse({
        name,
        description: 'Description',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty name', () => {
      const result = productSchema.safeParse({
        name: '',
        description: 'Description',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('description', () => {
    it('should accept description within limit', () => {
      const result = productSchema.safeParse({
        name: 'Product',
        description: 'This is a detailed description of the product.',
      })
      expect(result.success).toBe(true)
    })

    it('should accept description at limit (20000)', () => {
      const description = 'a'.repeat(20000)
      const result = productSchema.safeParse({
        name: 'Product',
        description,
      })
      expect(result.success).toBe(true)
    })

    it('should reject description exceeding limit', () => {
      const description = 'a'.repeat(20001)
      const result = productSchema.safeParse({
        name: 'Product',
        description,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('shortDescription', () => {
    it('should accept short description within limit', () => {
      const result = productSchema.safeParse({
        name: 'Product',
        description: 'Full description',
        shortDescription: 'Short',
      })
      expect(result.success).toBe(true)
    })

    it('should accept short description at limit (500)', () => {
      const shortDescription = 'a'.repeat(500)
      const result = productSchema.safeParse({
        name: 'Product',
        description: 'Full description',
        shortDescription,
      })
      expect(result.success).toBe(true)
    })

    it('should reject short description exceeding limit', () => {
      const shortDescription = 'a'.repeat(501)
      const result = productSchema.safeParse({
        name: 'Product',
        description: 'Full description',
        shortDescription,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('seoTitle and seoDescription', () => {
    it('should accept SEO fields within limit', () => {
      const result = productSchema.safeParse({
        name: 'Product',
        description: 'Full description',
        seoTitle: 'a'.repeat(300),
        seoDescription: 'b'.repeat(300),
      })
      expect(result.success).toBe(true)
    })

    it('should reject SEO title exceeding limit', () => {
      const result = productSchema.safeParse({
        name: 'Product',
        description: 'Full description',
        seoTitle: 'a'.repeat(301),
      })
      expect(result.success).toBe(false)
    })

    it('should reject SEO description exceeding limit', () => {
      const result = productSchema.safeParse({
        name: 'Product',
        description: 'Full description',
        seoDescription: 'b'.repeat(301),
      })
      expect(result.success).toBe(false)
    })
  })
})
