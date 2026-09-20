import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  listDeliveryOptions,
  getDeliveryOption,
  getDeliveryOptionExpense,
} from './delivery-options.js'

type Row = {
  key: string
  title: string
  subtitle: string | null
  price: number
  expense: number
  isActive: boolean
  sortOrder: number
}

const row = (over: Partial<Row> & { key: string }): Row => ({
  title: 'Способ',
  subtitle: null,
  price: 0,
  expense: 0,
  isActive: true,
  sortOrder: 0,
  ...over,
})

function fakePrisma(rows: Row[]) {
  const findMany = vi.fn(async ({ where }: { where?: { isActive?: boolean } } = {}) =>
    where?.isActive ? rows.filter((r) => r.isActive) : rows
  )
  const findUnique = vi.fn(async ({ where }: { where: { key: string } }) =>
    rows.find((r) => r.key === where.key) ?? null
  )
  return {
    prisma: { deliveryOption: { findMany, findUnique } } as unknown as PrismaClient,
    findMany,
  }
}

describe('listDeliveryOptions', () => {
  it('по умолчанию спрашивает у базы только включённые способы', async () => {
    const { prisma, findMany } = fakePrisma([
      row({ key: 'simba_courier', price: 70000 }),
      row({ key: 'ozon_pvz', isActive: false }),
    ])

    const options = await listDeliveryOptions(prisma)

    expect(findMany).toHaveBeenCalledWith({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
    expect(options.map((o) => o.key)).toEqual(['simba_courier'])
  })

  it('с includeInactive отдаёт и выключенные', async () => {
    const { prisma } = fakePrisma([
      row({ key: 'simba_courier' }),
      row({ key: 'ozon_pvz', isActive: false }),
    ])

    const options = await listDeliveryOptions(prisma, { includeInactive: true })

    expect(options.map((o) => o.key)).toEqual(['simba_courier', 'ozon_pvz'])
  })

  it('пропускает строки с незнакомым ключом — витрина их отобразить не умеет', async () => {
    const { prisma } = fakePrisma([
      row({ key: 'dostavista' }),
      row({ key: 'cdek_pvz', price: 9900 }),
    ])

    const options = await listDeliveryOptions(prisma)

    expect(options.map((o) => o.key)).toEqual(['cdek_pvz'])
  })

  it('отдаёт цену и заголовок из базы без изменений', async () => {
    const { prisma } = fakePrisma([
      row({ key: 'cdek_pvz', title: 'СДЭК', subtitle: 'до пункта выдачи', price: 14900 }),
    ])

    expect(await listDeliveryOptions(prisma)).toEqual([
      { key: 'cdek_pvz', kind: 'pickup_point', title: 'СДЭК', subtitle: 'до пункта выдачи', price: 14900 },
    ])
  })
})

describe('getDeliveryOption', () => {
  it('возвращает включённый способ с ценой из базы', async () => {
    const { prisma } = fakePrisma([row({ key: 'simba_courier', title: 'Курьер Simba', price: 70000 })])

    expect(await getDeliveryOption(prisma, 'simba_courier')).toMatchObject({
      key: 'simba_courier',
      price: 70000,
    })
  })

  it('выключенный способ — null, чтобы заказ по нему не оформился', async () => {
    const { prisma } = fakePrisma([row({ key: 'cdek_pvz', price: 9900, isActive: false })])

    expect(await getDeliveryOption(prisma, 'cdek_pvz')).toBeNull()
  })

  it('отсутствующий в базе способ — null', async () => {
    const { prisma } = fakePrisma([])

    expect(await getDeliveryOption(prisma, 'yandex_pvz')).toBeNull()
  })
})

describe('getDeliveryOptionExpense', () => {
  it('возвращает расход магазина из базы', async () => {
    const { prisma } = fakePrisma([row({ key: 'simba_courier', price: 70000, expense: 25000 })])

    expect(await getDeliveryOptionExpense(prisma, 'simba_courier')).toBe(25000)
  })

  it('нулевой расход — это 0, а не «не найдено»', async () => {
    const { prisma } = fakePrisma([row({ key: 'pickup', expense: 0 })])

    expect(await getDeliveryOptionExpense(prisma, 'pickup')).toBe(0)
  })

  it('выключенный или отсутствующий способ — null', async () => {
    const { prisma } = fakePrisma([row({ key: 'cdek_pvz', expense: 5000, isActive: false })])

    expect(await getDeliveryOptionExpense(prisma, 'cdek_pvz')).toBeNull()
    expect(await getDeliveryOptionExpense(prisma, 'ozon_pvz')).toBeNull()
  })
})
