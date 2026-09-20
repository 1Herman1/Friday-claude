import { PrismaClient, Prisma } from '@prisma/client'

/**
 * Нормализация email для единообразного хранения и поиска.
 * Убирает пробелы слева/справа и приводит в нижний регистр.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Найти существующего пользователя или создать нового по email.
 * Обработка гонки: если два запроса одновременно пытаются создать юзера с одним email,
 * второй попытается создать и получит ошибку P2002 (unique constraint), которую обработаем.
 */
export async function findOrCreateCustomerByEmail(
  prisma: PrismaClient,
  email: string,
  name?: string
): Promise<string> {
  const normalized = normalizeEmail(email)

  const existing = await prisma.user.findFirst({
    where: { email: normalized },
  })

  if (existing) {
    return existing.id
  }

  try {
    const created = await prisma.user.create({
      data: {
        email: normalized,
        name: name?.trim() || 'Покупатель',
        role: 'customer',
      },
    })
    return created.id
  } catch (err) {
    // P2002: гонка двух одновременных запросов на один email
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const retry = await prisma.user.findFirstOrThrow({
        where: { email: normalized },
      })
      return retry.id
    }
    throw err
  }
}
