import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

// Подменяем только выход во внешние службы: схемы, коды ответов и обработка
// сбоя — настоящие, роут и его валидация не мокаются.
vi.mock('../../services/delivery/delivery.service.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/delivery/delivery.service.js')>()),
  listPickupPoints: vi.fn(),
  getAllQuotes: vi.fn(),
}))

import { buildApp } from '../../index'
import { listPickupPoints, getAllQuotes } from '../../services/delivery/delivery.service.js'
import type { PickupPoint } from '../../services/delivery/types.js'

const point: PickupPoint = {
  provider: 'cdek',
  code: 'MSK-1',
  name: 'ПВЗ на Тверской',
  address: 'Москва, ул. Тверская, 1',
  lat: 55.7601,
  lon: 37.6156,
  workTime: 'пн–пт 10:00–20:00',
  phone: '+74951234567',
}

describe('GET /api/delivery/pickup-points', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.mocked(listPickupPoints).mockReset()
    vi.mocked(getAllQuotes).mockReset()
  })

  // Корзина лимита («pickup-points», 30 за 5 минут) живёт в памяти процесса и
  // ключуется по IP — у каждого теста свой адрес, иначе они мешают друг другу.
  const get = (query: string, ip: string) =>
    app.inject({ method: 'GET', url: `/api/delivery/pickup-points${query}`, remoteAddress: ip })

  it('без города и службы → 400, наружу к службе не ходит', async () => {
    const res = await get('', '10.1.0.1')

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Укажите службу доставки и город' })
    expect(listPickupPoints).not.toHaveBeenCalled()
  })

  it('город без службы → 400', async () => {
    const res = await get('?city=Москва', '10.1.0.2')

    expect(res.statusCode).toBe(400)
    expect(listPickupPoints).not.toHaveBeenCalled()
  })

  it('служба без пунктов выдачи (post) → 400', async () => {
    const res = await get('?provider=post&city=Москва', '10.1.0.3')

    expect(res.statusCode).toBe(400)
    expect(listPickupPoints).not.toHaveBeenCalled()
  })

  it('сбой службы → 502, а не пустой список', async () => {
    vi.mocked(listPickupPoints).mockRejectedValueOnce(new Error('CDEK pvz list failed: 503'))

    const res = await get('?provider=cdek&city=Москва', '10.1.0.4')

    expect(res.statusCode).toBe(502)
    expect(res.json()).toEqual({ error: 'Не удалось получить список пунктов выдачи' })
  })

  it('успех → 200 со списком пунктов', async () => {
    vi.mocked(listPickupPoints).mockResolvedValueOnce([point])

    const res = await get('?provider=cdek&city=Москва', '10.1.0.5')

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ points: [point] })
    expect(listPickupPoints).toHaveBeenCalledWith('cdek', 'Москва', undefined)
  })

  it('пустой список города — это 200, а не ошибка', async () => {
    vi.mocked(listPickupPoints).mockResolvedValueOnce([])

    const res = await get('?provider=yandex&city=Урюпинск', '10.1.0.6')

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ points: [] })
  })

  it('координаты из запроса передаются службе числами', async () => {
    vi.mocked(listPickupPoints).mockResolvedValueOnce([])

    const res = await get('?provider=yandex&city=Москва&lat=55.76&lon=37.61', '10.1.0.7')

    expect(res.statusCode).toBe(200)
    expect(listPickupPoints).toHaveBeenCalledWith('yandex', 'Москва', { lat: 55.76, lon: 37.61 })
  })

  it('одна координата без второй игнорируется, служба берёт центр города сама', async () => {
    vi.mocked(listPickupPoints).mockResolvedValueOnce([])

    const res = await get('?provider=yandex&city=Москва&lat=55.76', '10.1.0.8')

    expect(res.statusCode).toBe(200)
    expect(listPickupPoints).toHaveBeenCalledWith('yandex', 'Москва', undefined)
  })
})

describe('POST /api/delivery/quotes — пункт выдачи в запросе', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.mocked(getAllQuotes).mockReset().mockResolvedValue([])
  })

  const post = (payload: unknown, ip: string) =>
    app.inject({ method: 'POST', url: '/api/delivery/quotes', payload: payload as object, remoteAddress: ip })

  it('принимает pickupPoint и передаёт его в расчёт', async () => {
    const res = await post({ city: 'Москва', weightKg: 3, pickupPoint: point }, '10.2.0.1')

    expect(res.statusCode).toBe(200)
    // prisma — первый параметр, потом address, потом pkg
    const [, addressArg, pkgArg] = vi.mocked(getAllQuotes).mock.calls[0]
    expect(addressArg.pickupPoint).toEqual(point)
    expect(pkgArg).toEqual({ weightKg: 3 })
  })

  it('пункт чужой службы (post) отвергается до расчёта → 400', async () => {
    const res = await post(
      { city: 'Москва', weightKg: 3, pickupPoint: { ...point, provider: 'post' } },
      '10.2.0.2'
    )

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Не удалось рассчитать доставку по этому адресу' })
    expect(getAllQuotes).not.toHaveBeenCalled()
  })

  it('пункт без координат отвергается → 400', async () => {
    const { lat: _lat, ...noLat } = point
    const res = await post({ city: 'Москва', weightKg: 3, pickupPoint: noLat }, '10.2.0.3')

    expect(res.statusCode).toBe(400)
    expect(getAllQuotes).not.toHaveBeenCalled()
  })

  it('координаты адреса доходят до расчёта — по ним считает Яндекс', async () => {
    const res = await post({ city: 'Москва', weightKg: 1, lat: 55.76, lon: 37.61 }, '10.2.0.4')

    expect(res.statusCode).toBe(200)
    const [, addressArg] = vi.mocked(getAllQuotes).mock.calls[0]
    expect(addressArg.lat).toBe(55.76)
    expect(addressArg.lon).toBe(37.61)
  })
})
