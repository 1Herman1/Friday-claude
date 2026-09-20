import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { lookupCity, listPickupPoints, getCourierQuote, getPickupPointQuote, createOrder } from './cdek.js'
import type { DeliveryAddress } from '../types.js'

type Row = Record<string, unknown>

const jsonRes = (data: unknown) => ({ ok: true, status: 200, json: async () => data })
const failRes = (status: number) => ({ ok: false, status, json: async () => ({}) })

/** Ответы СДЭК по типу запроса: токен кэшируется в модуле, поэтому порядок
    вызовов между тестами не фиксирован — маршрутизируем по URL, а не по счёту. */
let cityRows: Row[]
let pvzPages: Row[][]
let pvzStatus: number
let urls: string[]

const pvz = (over: Row = {}): Row => ({
  code: 'MSK1',
  name: 'ПВЗ Тверская',
  location: { address_full: 'Москва, ул. Тверская, 1', latitude: 55.76, longitude: 37.61 },
  work_time: 'Пн-Пт 10:00-20:00',
  phones: [{ number: '+74951234567' }],
  ...over,
})

beforeEach(() => {
  process.env.CDEK_CLIENT_ID = 'test-id'
  process.env.CDEK_CLIENT_SECRET = 'test-secret'
  cityRows = []
  pvzPages = [[]]
  pvzStatus = 200
  urls = []

  global.fetch = vi.fn(async (url: string | URL | Request) => {
    const u = String(url)
    urls.push(u)
    if (u.includes('/oauth/token')) return jsonRes({ access_token: 'token', expires_in: 3600 })
    if (u.includes('/location/cities')) return jsonRes(cityRows)
    if (u.includes('/deliverypoints')) {
      if (pvzStatus !== 200) return failRes(pvzStatus)
      const page = Number(new URL(u).searchParams.get('page'))
      return jsonRes(pvzPages[page] ?? [])
    }
    throw new Error(`Неожиданный запрос: ${u}`)
  }) as unknown as typeof fetch
})

afterEach(() => {
  delete process.env.CDEK_CLIENT_ID
  delete process.env.CDEK_CLIENT_SECRET
  vi.restoreAllMocks()
})

describe('lookupCity', () => {
  it('предпочитает точное совпадение названия, а не первую строку справочника', async () => {
    cityRows = [
      { code: 1, city: 'Пушкино', latitude: 56.01, longitude: 37.85 },
      { code: 2, city: 'Пушкин', latitude: 59.72, longitude: 30.41 },
    ]

    expect(await lookupCity('пушкин')).toEqual({ code: 2, lat: 59.72, lon: 30.41 })
  })

  it('без точного совпадения берёт первую строку', async () => {
    cityRows = [{ code: 44, city: 'Москва (Московская обл.)' }]

    expect(await lookupCity('Москва')).toEqual({ code: 44, lat: undefined, lon: undefined })
  })

  it('пустой справочник → null', async () => {
    cityRows = []

    expect(await lookupCity('Урюпинск')).toBeNull()
  })

  it('без реквизитов → null и никаких запросов наружу', async () => {
    delete process.env.CDEK_CLIENT_ID

    expect(await lookupCity('Москва')).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('сбой справочника уходит наружу исключением', async () => {
    global.fetch = vi.fn(async (url: string | URL | Request) =>
      String(url).includes('/oauth/token')
        ? jsonRes({ access_token: 'token', expires_in: 3600 })
        : failRes(503)
    ) as unknown as typeof fetch

    await expect(lookupCity('Москва')).rejects.toThrow('CDEK city lookup failed: 503')
  })
})

describe('listPickupPoints', () => {
  it('переносит поля точки и отбрасывает точку без координат', async () => {
    cityRows = [{ code: 44, city: 'Москва' }]
    pvzPages = [[
      pvz(),
      pvz({ code: 'MSK2', name: 'Без координат', location: { address_full: 'Москва, ул. Арбат, 2' } }),
      pvz({ code: 'MSK3', name: 'Без телефона', work_time: undefined, phones: [] }),
    ]]

    const points = await listPickupPoints('Москва')

    expect(points.map((p) => p.code)).toEqual(['MSK1', 'MSK3'])
    expect(points[0]).toEqual({
      provider: 'cdek',
      code: 'MSK1',
      name: 'ПВЗ Тверская',
      address: 'Москва, ул. Тверская, 1',
      lat: 55.76,
      lon: 37.61,
      workTime: 'Пн-Пт 10:00-20:00',
      phone: '+74951234567',
    })
    expect(points[1].workTime).toBeUndefined()
    expect(points[1].phone).toBeUndefined()
  })

  it('первая страница запрашивается с page=0 и по коду найденного города', async () => {
    cityRows = [{ code: 137, city: 'Санкт-Петербург' }]
    pvzPages = [[pvz()]]

    await listPickupPoints('Санкт-Петербург')

    const pvzUrls = urls.filter((u) => u.includes('/deliverypoints'))
    expect(pvzUrls).toHaveLength(1)
    expect(pvzUrls[0]).toContain('page=0')
    expect(pvzUrls[0]).toContain('city_code=137')
  })

  it('полная страница тянет следующую, неполная останавливает обход', async () => {
    cityRows = [{ code: 44, city: 'Москва' }]
    const full = Array.from({ length: 1000 }, (_, i) => pvz({ code: `P${i}` }))
    pvzPages = [full, [pvz({ code: 'LAST' })]]

    const points = await listPickupPoints('Москва')

    expect(points).toHaveLength(1001)
    expect(points[1000].code).toBe('LAST')
    const pvzUrls = urls.filter((u) => u.includes('/deliverypoints'))
    expect(pvzUrls).toHaveLength(2)
    expect(pvzUrls[1]).toContain('page=1')
  })

  it('город не найден → пустой список, за точками не ходит', async () => {
    cityRows = []

    expect(await listPickupPoints('Урюпинск')).toEqual([])
    expect(urls.some((u) => u.includes('/deliverypoints'))).toBe(false)
  })

  it('сбой службы — исключение, а не «пунктов нет»', async () => {
    cityRows = [{ code: 44, city: 'Москва' }]
    pvzStatus = 503

    await expect(listPickupPoints('Москва')).rejects.toThrow('CDEK pvz list failed: 503')
  })
})

describe('Котировки СДЭК', () => {
  const point = {
    provider: 'cdek' as const,
    code: 'MSK1',
    name: 'ПВЗ Тверская',
    address: 'Москва, ул. Тверская, 1',
    lat: 55.76,
    lon: 37.61,
  }
  const address: DeliveryAddress = { city: 'Москва' }

  /** Тариф отвечает на любой POST /calculator/tariff. */
  const tariff = (data: unknown) => {
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const u = String(url)
      if (u.includes('/oauth/token')) return jsonRes({ access_token: 'token', expires_in: 3600 })
      if (u.includes('/calculator/tariff')) return jsonRes(data)
      throw new Error(`Неожиданный запрос: ${u}`)
    }) as unknown as typeof fetch
  }

  const lastBody = () => {
    const calls = vi.mocked(global.fetch).mock.calls
    const call = calls.find(([u]) => String(u).includes('/calculator/tariff'))!
    return JSON.parse(String((call[1] as RequestInit).body))
  }

  it('рубли службы переводятся в копейки, вес — в граммы с округлением вверх', async () => {
    tariff({ delivery_sum: 349.5, period_min: 3, period_max: 6 })

    const quote = await getPickupPointQuote({ ...address, pickupPoint: point }, { weightKg: 1.2345 })

    expect(quote).toMatchObject({ available: true, price: 34950, daysMin: 3, daysMax: 6 })
    expect(lastBody().packages[0].weight).toBe(1235)
  })

  it('пункт выдачи считается по складскому тарифу, курьер — по дверному', async () => {
    tariff({ delivery_sum: 100 })
    await getPickupPointQuote({ ...address, pickupPoint: point }, { weightKg: 1 })
    expect(lastBody().tariff_code).toBe(136)

    tariff({ delivery_sum: 100 })
    await getCourierQuote(address, { weightKg: 1 })
    expect(lastBody().tariff_code).toBe(137)
  })

  it('без выбранного пункта ПВЗ-котировка недоступна и денег не называет', async () => {
    tariff({ delivery_sum: 100 })

    const quote = await getPickupPointQuote(address, { weightKg: 1 })

    expect(quote).toMatchObject({ available: false, price: 0, error: 'Выберите пункт выдачи' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('без реквизитов службы — недоступно, а не бесплатно', async () => {
    delete process.env.CDEK_CLIENT_SECRET

    const quote = await getCourierQuote(address, { weightKg: 1 })

    expect(quote).toMatchObject({ available: false, price: 0, error: 'Служба доставки не подключена' })
  })

  it('сбой тарифа не роняет расчёт: вариант помечается недоступным', async () => {
    global.fetch = vi.fn(async (url: string | URL | Request) =>
      String(url).includes('/oauth/token')
        ? jsonRes({ access_token: 'token', expires_in: 3600 })
        : failRes(500)
    ) as unknown as typeof fetch

    const quote = await getCourierQuote(address, { weightKg: 1 })

    expect(quote.available).toBe(false)
    expect(quote.price).toBe(0)
    expect(quote.error).toContain('500')
  })

  it('ответ без суммы тарифа не превращается в нулевую доставку', async () => {
    tariff({ period_min: 2, period_max: 4 })

    const quote = await getCourierQuote(address, { weightKg: 1 })

    expect(quote.available).toBe(false)
    expect(quote.price).toBe(0)
  })
})

describe('Заявка в СДЭК', () => {
  const point = {
    provider: 'cdek' as const,
    code: 'MSK1',
    name: 'ПВЗ Тверская',
    address: 'Москва, ул. Тверская, 1',
    lat: 55.76,
    lon: 37.61,
  }

  const orders = (data: unknown, ok = true, status = 200) => {
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const u = String(url)
      if (u.includes('/oauth/token')) return jsonRes({ access_token: 'token', expires_in: 3600 })
      if (u.includes('/orders')) return ok ? jsonRes(data) : failRes(status)
      throw new Error(`Неожиданный запрос: ${u}`)
    }) as unknown as typeof fetch
  }

  const sentBody = () => {
    const call = vi.mocked(global.fetch).mock.calls.find(([u]) => String(u).includes('/orders'))!
    return JSON.parse(String((call[1] as RequestInit).body))
  }

  it('в пункт выдачи уезжает код точки, а не адрес получателя', async () => {
    orders({ entity: { uuid: 'uuid-1' } })

    const result = await createOrder(
      { city: 'Москва', pickupPoint: point },
      { weightKg: 2 },
      'ORD-1'
    )

    const body = sentBody()
    expect(body.delivery_point).toBe('MSK1')
    expect(body.tariff_code).toBe(136)
    // Адреса у заявки в ПВЗ быть не должно: посылка едет на склад точки.
    expect(body.to_location.address).toBeUndefined()
    expect(result.externalId).toBe('uuid-1')
    expect(result.trackingUrl).toContain('uuid-1')
  })

  it('курьеру уезжает улица с домом и дверной тариф, без кода точки', async () => {
    orders({ entity: { uuid: 'uuid-2' } })

    await createOrder(
      { city: 'Москва', street: 'ул. Тверская', house: '1', postalCode: '101000' },
      { weightKg: 2 },
      'ORD-2'
    )

    const body = sentBody()
    expect(body.delivery_point).toBeUndefined()
    expect(body.tariff_code).toBe(137)
    expect(body.to_location).toMatchObject({ city: 'Москва', address: 'ул. Тверская, 1', postal_code: '101000' })
  })

  it('отказ службы уходит исключением, а не «заявка создана»', async () => {
    orders(null, false, 400)

    await expect(createOrder({ city: 'Москва' }, { weightKg: 1 }, 'ORD-3'))
      .rejects.toThrow('CDEK create order failed: 400')
  })

  it('без реквизитов возвращает заглушку и наружу не ходит', async () => {
    delete process.env.CDEK_CLIENT_ID

    const result = await createOrder({ city: 'Москва' }, { weightKg: 1 }, 'ORD-4')

    expect(result.externalId).toBe('CDEK-MOCK-ORD-4')
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
