import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const slugSchema = z.string().regex(/^[a-z0-9-]+$/, 'Slug должен содержать только латиницу, цифры и дефисы')

describe('Product Slug Validation', () => {
  it('should accept valid slug with lowercase letters', () => {
    expect(slugSchema.safeParse('my-product').success).toBe(true)
  })

  it('should accept valid slug with numbers', () => {
    expect(slugSchema.safeParse('product-123').success).toBe(true)
  })

  it('should accept valid slug with dashes', () => {
    expect(slugSchema.safeParse('my-awesome-product-v2').success).toBe(true)
  })

  it('should reject slug with uppercase letters', () => {
    expect(slugSchema.safeParse('MyProduct').success).toBe(false)
  })

  it('should reject slug with spaces', () => {
    expect(slugSchema.safeParse('my product').success).toBe(false)
  })

  it('should reject slug with special characters', () => {
    expect(slugSchema.safeParse('my@product!').success).toBe(false)
  })

  it('should reject slug with cyrillic characters', () => {
    expect(slugSchema.safeParse('мой-продукт').success).toBe(false)
  })

  it('should reject slug with underscores', () => {
    expect(slugSchema.safeParse('my_product').success).toBe(false)
  })

  it('should accept slug starting with number', () => {
    expect(slugSchema.safeParse('123-product').success).toBe(true)
  })

  it('should reject empty slug', () => {
    expect(slugSchema.safeParse('').success).toBe(false)
  })
})
