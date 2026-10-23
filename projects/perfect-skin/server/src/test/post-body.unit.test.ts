import { describe, it, expect } from 'vitest'
import { extractProductSlugs } from '../lib/post-body.js'

describe('extractProductSlugs', () => {
  it('достаёт слаги из [[product:...]] без повторов', () => {
    const body = 'Текст [[product:serum-a]] и снова [[product:serum-a]], далее [[product:krem-b]].'
    expect(extractProductSlugs(body)).toEqual(['serum-a', 'krem-b'])
  })

  it('игнорирует некорректные ссылки', () => {
    expect(extractProductSlugs('[[product:Serum_A]] [[product:]] [product:ok]')).toEqual([])
  })
})
