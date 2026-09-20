import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { guestCleanupDaysSchema } from '../services/guest-cleanup.service'

/**
 * scripts/cleanup-guests.ts вызывает main() прямо на импорте и создаёт
 * PrismaClient на верхнем уровне модуля, поэтому здесь замокан сам клиент БД
 * (внешняя граница) и заглушен process.exit — иначе импорт ради одной чистой
 * функции сходил бы в базу и убил процесс тестов.
 */
vi.mock('@prisma/client', () => {
  class PrismaClient {
    user = { count: async () => 0, findMany: async () => [] }
    consent = { updateMany: async () => ({ count: 0 }) }
    syncRun = {
      findFirst: async () => null,
      create: async () => ({ id: 'run-test' }),
      update: async () => ({}),
    }
    $transaction = async (fn: (tx: unknown) => unknown) => fn(this)
    $disconnect = async () => {}
  }
  return { PrismaClient, Prisma: {} }
})

let parseDaysArg: (input: string) => number

describe('parseDaysArg (аргументы скрипта чистки)', () => {
  const spies: Array<{ mockRestore: () => void }> = []

  beforeAll(async () => {
    spies.push(vi.spyOn(process, 'exit').mockImplementation(((): never => undefined as never)))
    spies.push(vi.spyOn(console, 'log').mockImplementation(() => {}))
    spies.push(vi.spyOn(console, 'error').mockImplementation(() => {}))
    const mod = await import('../scripts/cleanup-guests')
    parseDaysArg = mod.parseDaysArg
  })

  afterAll(() => {
    for (const spy of spies) spy.mockRestore()
  })

  it('без аргумента действует значение по умолчанию — 30 дней', () => {
    expect(guestCleanupDaysSchema.parse(undefined)).toBe(30)
  })

  it.each([
    ['30', 30],
    ['60', 60],
    ['7', 7],
    ['365', 365],
  ])('принимает --days=%s', (input, expected) => {
    expect(parseDaysArg(input)).toBe(expected)
  })

  it.each(['abc', '-5', '3', '400', '30abc', '30.5', '', ' '])(
    'отвергает --days=%s',
    (input) => {
      expect(() => parseDaysArg(input)).toThrow(/days/i)
    }
  )

  it('не превращает 30abc в 30 (ловушка parseInt)', () => {
    expect(() => parseDaysArg('30abc')).toThrow()
  })
})
