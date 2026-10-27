import { describe, it, expect } from 'vitest'
import { photoFirst } from '../services/catalog.service.js'

describe('photoFirst', () => {
  it('ставит товары с фото впереди и сохраняет порядок внутри групп', () => {
    const items = [
      { id: 'a', images: [] },
      { id: 'b', images: ['/products/b.jpg'] },
      { id: 'c', images: [] },
      { id: 'd', images: ['/products/d.jpg'] },
    ]

    expect(photoFirst(items).map((p) => p.id)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('возвращает пустой список как есть', () => {
    expect(photoFirst([])).toEqual([])
  })
})
