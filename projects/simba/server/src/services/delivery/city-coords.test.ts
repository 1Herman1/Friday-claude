import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./providers/cdek.js', () => ({ lookupCity: vi.fn() }))
vi.mock('../address/dadata.js', () => ({ suggestAddress: vi.fn() }))

import { lookupCity } from './providers/cdek.js'
import { suggestAddress } from '../address/dadata.js'
import { getCityCoords } from './city-coords.js'

describe('Центр города для пунктов Яндекса', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.DADATA_TOKEN
  })

  it('берёт координаты из справочника СДЭК и запоминает их', async () => {
    vi.mocked(lookupCity).mockResolvedValue({ code: 44, lat: 55.75, lon: 37.62 })
    expect(await getCityCoords('Тверь-тест-1')).toEqual({ lat: 55.75, lon: 37.62 })
    expect(await getCityCoords('тверь-тест-1 ')).toEqual({ lat: 55.75, lon: 37.62 })
    expect(lookupCity).toHaveBeenCalledTimes(1)
  })

  it('сбой подключённой службы уходит наружу, а не запоминается как «города нет»', async () => {
    vi.mocked(lookupCity)
      .mockRejectedValueOnce(new Error('CDEK city lookup failed: 503'))
      .mockResolvedValueOnce({ code: 1, lat: 1, lon: 2 })
    await expect(getCityCoords('Тверь-тест-2')).rejects.toThrow('503')
    expect(await getCityCoords('Тверь-тест-2')).toEqual({ lat: 1, lon: 2 })
  })

  it('без СДЭК спрашивает DaData, без обоих — честный null', async () => {
    vi.mocked(lookupCity).mockResolvedValue(null)
    expect(await getCityCoords('Тверь-тест-3')).toBeNull()
    expect(suggestAddress).not.toHaveBeenCalled()

    process.env.DADATA_TOKEN = 't'
    vi.mocked(suggestAddress).mockResolvedValue([
      { value: 'Тверь', city: 'Тверь', street: '', house: '', lat: 56.86, lon: 35.9, complete: false },
    ])
    expect(await getCityCoords('Тверь-тест-4')).toEqual({ lat: 56.86, lon: 35.9 })
  })
})
