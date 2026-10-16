import { describe, it, expect } from 'vitest'
import { nextPreviousSlugs } from '../lib/slug-history.js'

describe('nextPreviousSlugs', () => {
  it('добавляет старый адрес при переименовании', () => {
    expect(nextPreviousSlugs([], 'alpha', 'beta')).toEqual(['alpha'])
  })

  it('копит историю при повторном переименовании', () => {
    expect(nextPreviousSlugs(['alpha'], 'beta', 'gamma')).toEqual(['alpha', 'beta'])
  })

  it('убирает адрес из истории, если переименовали обратно на старый', () => {
    expect(nextPreviousSlugs(['alpha', 'beta'], 'gamma', 'alpha')).toEqual(['beta', 'gamma'])
  })

  it('не дублирует адрес и сохраняет порядок', () => {
    expect(nextPreviousSlugs(['alpha', 'beta'], 'beta', 'gamma')).toEqual(['alpha', 'beta'])
  })

  it('при одинаковых адресах возвращает историю без изменений', () => {
    const current = ['alpha']
    expect(nextPreviousSlugs(current, 'beta', 'beta')).toBe(current)
  })

  it('обрезает историю до 20 адресов, отбрасывая самые старые', () => {
    const history = Array.from({ length: 20 }, (_, i) => `old-${i}`)
    const next = nextPreviousSlugs(history, 'current', 'renamed')
    expect(next).toHaveLength(20)
    expect(next[0]).toBe('old-1')
    expect(next[19]).toBe('current')
  })
})
