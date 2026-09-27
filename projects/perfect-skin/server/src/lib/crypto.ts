import { createHash, randomBytes } from 'node:crypto'

export const crypto = {
  randomBytes,
}

/**
 * Хеш SHA256 для токенов и кодов привязки.
 * Сравнение через поиск по индексу на хеше — тайминг-атака на хеш не практична.
 */
export async function createTokenHash(token: string): Promise<string> {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Генерирует одноразовый код привязки (8 символов без путаницы 0/O/1/l).
 */
export function generateLinkCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // без 0, O, 1, l
  let code = ''
  const bytes = randomBytes(8)
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length]
  }
  return code
}
