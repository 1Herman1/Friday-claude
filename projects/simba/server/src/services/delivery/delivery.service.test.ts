import { describe, expect, it, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import type { DeliveryAddress, DeliveryPackage, PickupPoint } from './types.js'
import { hasTestDb, getTestPrisma, resetDb, closeTestPrisma } from '../../test/setup.js'
import { seedDeliveryOptions } from '../../test/factories.js'

vi.mock('./providers/cdek.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./providers/cdek.js')>()),
  listPickupPoints: vi.fn(),
}))
vi.mock('./providers/yandex-pvz.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./providers/yandex-pvz.js')>()),
  listPickupPoints: vi.fn(),
}))
vi.mock('./city-coords.js', () => ({ getCityCoords: vi.fn() }))

import * as cdek from './providers/cdek.js'
import * as yandexPvz from './providers/yandex-pvz.js'
import { getCityCoords } from './city-coords.js'
import { listPickupPoints, getQuoteForMethod, clearPickupPointsCache } from './delivery.service.js'

const point = (code: string): PickupPoint => ({
  provider: 'cdek', code, name: code, address: 'ул. Тестовая, 1', lat: 55.75, lon: 37.62,
})

describe.skipIf(!hasTestDb)('Delivery Service', () => {
  beforeAll(async () => {
    // Ничего не нужно — БД уже готова
  })

  afterAll(async () => {
    await closeTestPrisma()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    clearPickupPointsCache()
  })

  describe('listPickupPoints', () => {
    it('второй запрос того же города берётся из кэша, служба не дёргается', async () => {
      vi.mocked(cdek.listPickupPoints).mockResolvedValue([point('A')])

      const first = await listPickupPoints('cdek', 'Москва')
      const second = await listPickupPoints('cdek', 'МОСКВА ')

      expect(first).toEqual([point('A')])
      expect(second).toBe(first)
      expect(cdek.listPickupPoints).toHaveBeenCalledTimes(1)
    })

    it('разные города — разные запросы', async () => {
      vi.mocked(cdek.listPickupPoints).mockResolvedValue([])
      await listPickupPoints('cdek', 'Москва')
      await listPickupPoints('cdek', 'Казань')
      expect(cdek.listPickupPoints).toHaveBeenCalledTimes(2)
    })

    it('сбой службы уходит наружу и не кэшируется', async () => {
      vi.mocked(cdek.listPickupPoints)
        .mockRejectedValueOnce(new Error('CDEK pvz list failed: 503'))
        .mockResolvedValueOnce([point('B')])

      await expect(listPickupPoints('cdek', 'Москва')).rejects.toThrow('503')
      // Иначе после одного сбоя город сутки показывал бы «пунктов нет».
      expect(await listPickupPoints('cdek', 'Москва')).toEqual([point('B')])
      expect(cdek.listPickupPoints).toHaveBeenCalledTimes(2)
    })

    it('Яндексу без координат находит центр города, а без центра пунктов не просит', async () => {
      vi.mocked(getCityCoords).mockResolvedValueOnce({ lat: 55.75, lon: 37.62 })
      vi.mocked(yandexPvz.listPickupPoints).mockResolvedValue([])

      await listPickupPoints('yandex', 'Москва')
      expect(yandexPvz.listPickupPoints).toHaveBeenCalledWith({ lat: 55.75, lon: 37.62 })

      vi.mocked(getCityCoords).mockResolvedValueOnce(null)
      expect(await listPickupPoints('yandex', 'Нигдешинск')).toEqual([])
      expect(yandexPvz.listPickupPoints).toHaveBeenCalledTimes(1)
    })

    it('переданные координаты важнее справочника', async () => {
      vi.mocked(yandexPvz.listPickupPoints).mockResolvedValue([])
      await listPickupPoints('yandex', 'Москва', { lat: 1, lon: 2 })
      expect(getCityCoords).not.toHaveBeenCalled()
      expect(yandexPvz.listPickupPoints).toHaveBeenCalledWith({ lat: 1, lon: 2 })
    })
  })

  describe('getQuoteForMethod', () => {
    beforeEach(async () => {
      await resetDb()
      await seedDeliveryOptions()
    })

    it('курьер в Москве возвращает котировку с ценой из таблицы', async () => {
      const prisma = getTestPrisma()
      const address: DeliveryAddress = {
        city: 'Москва',
        street: 'ул. Ленина',
        house: '1',
      }
      const pkg: DeliveryPackage = { weightKg: 1 }

      const quote = await getQuoteForMethod(prisma, 'simba_courier', address, pkg)
      expect(quote.available).toBe(true)
      expect(quote.price).toBe(70000) // из таблицы
      expect(quote.daysMin).toBe(0)
      expect(quote.daysMax).toBe(0)
    })

    it('курьер вне Москвы выбрасывает ошибку', async () => {
      const prisma = getTestPrisma()
      const address: DeliveryAddress = {
        city: 'Казань',
        street: 'ул. Ленина',
        house: '1',
      }
      const pkg: DeliveryPackage = { weightKg: 1 }

      await expect(getQuoteForMethod(prisma, 'simba_courier', address, pkg))
        .rejects.toThrow('Курьером доставляем только по Москве')
    })

    it('пункт выдачи требует выбранный пункт', async () => {
      const prisma = getTestPrisma()
      const address: DeliveryAddress = { city: 'Москва' }
      const pkg: DeliveryPackage = { weightKg: 1 }

      await expect(getQuoteForMethod(prisma, 'cdek', address, pkg))
        .rejects.toThrow('Выберите пункт выдачи')
    })

    it('пункт выдачи неправильного провайдера выбрасывает ошибку', async () => {
      const prisma = getTestPrisma()
      const address: DeliveryAddress = {
        city: 'Москва',
        pickupPoint: {
          provider: 'yandex',
          code: 'YA123',
          name: 'Точка Яндекса',
          address: 'ул. Ленина, 1',
          lat: 55.75,
          lon: 37.62,
        },
      }
      const pkg: DeliveryPackage = { weightKg: 1 }

      await expect(getQuoteForMethod(prisma, 'cdek', address, pkg))
        .rejects.toThrow('Пункт выдачи не относится к выбранной службе')
    })

    it('самовывоз всегда доступен и бесплатен', async () => {
      const prisma = getTestPrisma()
      const address: DeliveryAddress = { city: 'Москва' }
      const pkg: DeliveryPackage = { weightKg: 1 }

      const quote = await getQuoteForMethod(prisma, 'pickup', address, pkg)
      expect(quote.available).toBe(true)
      expect(quote.price).toBe(0)
      expect(quote.daysMin).toBe(0)
      expect(quote.daysMax).toBe(0)
    })

    it('выключенный способ доставки выбрасывает ошибку', async () => {
      const prisma = getTestPrisma()
      // ozon_pvz выключен по умолчанию в seedDeliveryOptions
      const address: DeliveryAddress = {
        city: 'Москва',
        pickupPoint: {
          provider: 'ozon',
          code: 'OZ123',
          name: 'Ozon',
          address: 'ул. Ленина, 1',
          lat: 55.75,
          lon: 37.62,
        },
      }
      const pkg: DeliveryPackage = { weightKg: 1 }

      await expect(getQuoteForMethod(prisma, 'ozon', address, pkg))
        .rejects.toThrow('Этот способ доставки сейчас недоступен')
    })
  })
})
