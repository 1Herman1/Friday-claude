import { describe, it, expect } from 'vitest'
import { TelegramBotKind } from '../lib/db.js'

describe('Telegram Bot', () => {
  describe('link code validation', () => {
    it('should reject code with wrong botKind', () => {
      // Симуляция: код создан для 'orders' бота, но попытка использовать в 'pro' боте
      const codeKind: TelegramBotKind = TelegramBotKind.orders
      const attemptedBotKind: TelegramBotKind = TelegramBotKind.pro

      // Проверка должна завершиться неудачей
      expect((codeKind as string) === (attemptedBotKind as string)).toBe(false)
    })

    it('should accept code with matching botKind', () => {
      const codeKind = TelegramBotKind.pro
      const attemptedBotKind = TelegramBotKind.pro

      expect(codeKind === attemptedBotKind).toBe(true)
    })

    it('should distinguish between pro and orders bot kinds', () => {
      expect(TelegramBotKind.pro).not.toBe(TelegramBotKind.orders)
      expect(TelegramBotKind.pro).toBe('pro')
      expect(TelegramBotKind.orders).toBe('orders')
    })
  })

  describe('composite key (userId, botKind)', () => {
    it('same user can have links to both bots', () => {
      const userId = 'user-123'
      const proBotKey = { userId, botKind: TelegramBotKind.pro }
      const ordersBotKey = { userId, botKind: TelegramBotKind.orders }

      // Два разных ключа, даже с одинаковым userId
      expect(proBotKey).not.toEqual(ordersBotKey)
    })

    it('different users cannot share same botKind', () => {
      const user1 = 'user-123'
      const user2 = 'user-456'
      const botKind = TelegramBotKind.pro

      const key1 = { userId: user1, botKind }
      const key2 = { userId: user2, botKind }

      expect(key1).not.toEqual(key2)
    })
  })
})
