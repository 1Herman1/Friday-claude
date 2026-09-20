import { describe, it, expect } from 'vitest'
import { formatSchedule, mapPoints } from './yandex-pvz.js'

describe('Пункты выдачи Яндекса', () => {
  it('собирает расписание в читаемую строку', () => {
    expect(formatSchedule([
      { days: [1, 2, 3, 4, 5], time_from: { hours: 9, minutes: 0 }, time_to: { hours: 21, minutes: 0 } },
      { days: [6, 7], time_from: { hours: 10, minutes: 30 }, time_to: { hours: 18, minutes: 0 } },
    ])).toBe('пн–пт 09:00–21:00, сб–вс 10:30–18:00')
    expect(formatSchedule([{ days: [1, 3, 5], time_from: { hours: 9, minutes: 0 }, time_to: { hours: 18, minutes: 0 } }]))
      .toBe('пн, ср, пт 09:00–18:00')
    expect(formatSchedule(undefined)).toBeUndefined()
    expect(formatSchedule([])).toBeUndefined()
  })

  it('берёт только обычные пункты выдачи с адресом и координатами', () => {
    const rows = [
      { id: 'a', type: 'pickup_point', name: 'ПВЗ А', address: { full_address: 'Москва, Тверская, 1' }, position: { latitude: 55.76, longitude: 37.6 } },
      { id: 'b', type: 'terminal', name: 'Постамат', address: { full_address: 'Москва, Арбат, 2' }, position: { latitude: 55.75, longitude: 37.59 } },
      { id: 'c', type: 'pickup_point', is_dark_store: true, name: 'Даркстор', address: { full_address: 'x' }, position: { latitude: 1, longitude: 1 } },
      { id: 'd', type: 'pickup_point', name: 'Без координат', address: { full_address: 'x' } },
    ]
    const points = mapPoints(rows)
    expect(points.map((p) => p.code)).toEqual(['a'])
    expect(points[0]).toMatchObject({ provider: 'yandex', address: 'Москва, Тверская, 1', lat: 55.76, lon: 37.6 })
  })
})
