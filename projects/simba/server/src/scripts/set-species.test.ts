import { describe, it, expect } from 'vitest'
import { parseArgs } from './set-species'

describe('parseArgs', () => {
  it('парсит одиночный id для одного вида', () => {
    const result = parseArgs(['cat=123e4567-e89b-12d3-a456-426614174000'])
    expect(result.apply).toBe(false)
    expect(result.updates.size).toBe(1)
    expect(result.updates.get('123e4567-e89b-12d3-a456-426614174000')).toBe('cat')
  })

  it('парсит несколько id для одного вида через запятую', () => {
    const result = parseArgs([
      'dog=123e4567-e89b-12d3-a456-426614174000,223e4567-e89b-12d3-a456-426614174000',
    ])
    expect(result.updates.size).toBe(2)
    expect(result.updates.get('123e4567-e89b-12d3-a456-426614174000')).toBe('dog')
    expect(result.updates.get('223e4567-e89b-12d3-a456-426614174000')).toBe('dog')
  })

  it('парсит несколько видов', () => {
    const result = parseArgs([
      'cat=123e4567-e89b-12d3-a456-426614174000',
      'dog=223e4567-e89b-12d3-a456-426614174001',
    ])
    expect(result.updates.size).toBe(2)
    expect(result.updates.get('123e4567-e89b-12d3-a456-426614174000')).toBe('cat')
    expect(result.updates.get('223e4567-e89b-12d3-a456-426614174001')).toBe('dog')
  })

  it('распознаёт флаг --apply', () => {
    const result = parseArgs(['cat=123e4567-e89b-12d3-a456-426614174000', '--apply'])
    expect(result.apply).toBe(true)
    expect(result.updates.size).toBe(1)
  })

  it('обрабатывает пробелы в списке id', () => {
    const result = parseArgs(['cat=123e4567-e89b-12d3-a456-426614174000 , 223e4567-e89b-12d3-a456-426614174001'])
    expect(result.updates.size).toBe(2)
    expect(result.updates.has('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    expect(result.updates.has('223e4567-e89b-12d3-a456-426614174001')).toBe(true)
  })

  it('выходит с ошибкой при неизвестном виде', () => {
    expect(() => parseArgs(['unknown_species=123e4567-e89b-12d3-a456-426614174000'])).toThrow()
  })

  it('выходит с ошибкой при неверном UUID', () => {
    expect(() => parseArgs(['cat=not-a-uuid'])).toThrow()
  })

  it('выходит с ошибкой при дубликате id в разных видах', () => {
    expect(() =>
      parseArgs([
        'cat=123e4567-e89b-12d3-a456-426614174000',
        'dog=123e4567-e89b-12d3-a456-426614174000',
      ])
    ).toThrow()
  })

  it('позволяет одинаковый id для одного вида (идемпотент)', () => {
    const result = parseArgs(['cat=123e4567-e89b-12d3-a456-426614174000,123e4567-e89b-12d3-a456-426614174000'])
    expect(result.updates.size).toBe(1)
    expect(result.updates.get('123e4567-e89b-12d3-a456-426614174000')).toBe('cat')
  })

  it('парсит both и unknown', () => {
    const result = parseArgs([
      'both=123e4567-e89b-12d3-a456-426614174000',
      'unknown=223e4567-e89b-12d3-a456-426614174001',
    ])
    expect(result.updates.get('123e4567-e89b-12d3-a456-426614174000')).toBe('both')
    expect(result.updates.get('223e4567-e89b-12d3-a456-426614174001')).toBe('unknown')
  })

  it('игнорирует аргументы без =', () => {
    const result = parseArgs(['--apply', 'some-arg', 'cat=123e4567-e89b-12d3-a456-426614174000'])
    expect(result.apply).toBe(true)
    expect(result.updates.size).toBe(1)
  })
})
