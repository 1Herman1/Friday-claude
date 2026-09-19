import { describe, it, expect } from 'vitest'
import { withSpeciesTag } from './quiz-tags'

describe('withSpeciesTag', () => {
  it('добавляет тег species:cat для cat', () => {
    const result = withSpeciesTag(['age:adult', 'format:dry'], 'cat')
    expect(result).toContain('species:cat')
    expect(result).toContain('age:adult')
    expect(result).toContain('format:dry')
    expect(result).not.toContain('species:dog')
  })

  it('добавляет тег species:dog для dog', () => {
    const result = withSpeciesTag(['age:puppy'], 'dog')
    expect(result).toContain('species:dog')
    expect(result).toContain('age:puppy')
    expect(result).not.toContain('species:cat')
  })

  it('удаляет существующий species:cat при смене на dog', () => {
    const result = withSpeciesTag(['species:cat', 'age:adult'], 'dog')
    expect(result).toContain('species:dog')
    expect(result).not.toContain('species:cat')
    expect(result).toContain('age:adult')
  })

  it('удаляет все species:* теги для both', () => {
    const result = withSpeciesTag(['species:cat', 'age:adult', 'species:dog'], 'both')
    expect(result).not.toContain('species:cat')
    expect(result).not.toContain('species:dog')
    expect(result).toContain('age:adult')
  })

  it('удаляет все species:* теги для unknown', () => {
    const result = withSpeciesTag(['species:cat', 'age:adult'], 'unknown')
    expect(result).not.toContain('species:cat')
    expect(result).not.toContain('species:dog')
    expect(result).toContain('age:adult')
  })

  it('сохраняет порядок остальных тегов', () => {
    const input = ['age:adult', 'format:dry', 'health:digestion']
    const result = withSpeciesTag(input, 'cat')
    // После species:cat добавляются исходные теги в том же порядке
    expect(result).toEqual(['age:adult', 'format:dry', 'health:digestion', 'species:cat'])
  })

  it('обрабатывает пустой массив', () => {
    const result = withSpeciesTag([], 'cat')
    expect(result).toEqual(['species:cat'])
  })

  it('обрабатывает только species:* теги', () => {
    const result = withSpeciesTag(['species:cat', 'species:dog'], 'cat')
    expect(result).toEqual(['species:cat'])
  })
})
