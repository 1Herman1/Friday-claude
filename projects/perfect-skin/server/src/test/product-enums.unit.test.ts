import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const skinTypeEnum = z.enum([
  'normal',
  'dry',
  'oily',
  'combination',
  'sensitive',
  'mature',
  'all_types',
])

const concernEnum = z.enum([
  'hydration',
  'anti_age',
  'pigmentation',
  'acne',
  'sensitivity',
  'redness',
  'cleansing',
  'sun_protection',
  'firming',
  'eye_area',
  'post_procedure',
  'regeneration',
  'radiance',
  'sebum_control',
  'hygiene',
  'barrier',
  'daily_care',
  'express_care',
  'intensive_care',
  'nourishing',
])

const productSchema = z.object({
  skinTypes: z.array(skinTypeEnum).optional(),
  concerns: z.array(concernEnum).optional(),
})

describe('Product Enums', () => {
  describe('skinTypes', () => {
    it('should accept valid skin type', () => {
      const result = productSchema.safeParse({
        skinTypes: ['dry'],
      })
      expect(result.success).toBe(true)
    })

    it('should accept multiple valid skin types', () => {
      const result = productSchema.safeParse({
        skinTypes: ['dry', 'sensitive', 'combination'],
      })
      expect(result.success).toBe(true)
    })

    it('should accept all valid skin types', () => {
      const result = productSchema.safeParse({
        skinTypes: ['normal', 'dry', 'oily', 'combination', 'sensitive', 'mature', 'all_types'],
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid skin type', () => {
      const result = productSchema.safeParse({
        skinTypes: ['invalid-type'],
      })
      expect(result.success).toBe(false)
    })

    it('should accept empty array', () => {
      const result = productSchema.safeParse({
        skinTypes: [],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('concerns', () => {
    it('should accept valid concern', () => {
      const result = productSchema.safeParse({
        concerns: ['acne'],
      })
      expect(result.success).toBe(true)
    })

    it('should accept multiple valid concerns', () => {
      const result = productSchema.safeParse({
        concerns: ['hydration', 'anti_age', 'firming'],
      })
      expect(result.success).toBe(true)
    })

    it('should accept all valid concerns', () => {
      const result = productSchema.safeParse({
        concerns: [
          'hydration',
          'anti_age',
          'pigmentation',
          'acne',
          'sensitivity',
          'redness',
          'cleansing',
          'sun_protection',
          'firming',
          'eye_area',
          'post_procedure',
          'regeneration',
          'radiance',
          'sebum_control',
          'hygiene',
          'barrier',
          'daily_care',
          'express_care',
          'intensive_care',
          'nourishing',
        ],
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid concern', () => {
      const result = productSchema.safeParse({
        concerns: ['fake-concern'],
      })
      expect(result.success).toBe(false)
    })

    it('should reject mixed valid and invalid concerns', () => {
      const result = productSchema.safeParse({
        concerns: ['hydration', 'invalid'],
      })
      expect(result.success).toBe(false)
    })
  })
})
