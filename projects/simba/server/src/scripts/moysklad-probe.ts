import { PrismaClient } from '@prisma/client'

// Диагностика токена МойСклада для лога деплоя: только HTTP-статусы, ни
// значения токена, ни данных. Отвечает на вопрос «токен вообще рабочий или
// ему не хватает прав именно на картинки».
const BASE_URL = 'https://api.moysklad.ru/api/remap/1.2'
const prisma = new PrismaClient()

async function status(path: string): Promise<string> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${process.env.MOYSKLAD_TOKEN}`, 'Accept-Encoding': 'gzip' },
      signal: AbortSignal.timeout(10_000),
    })
    return String(res.status)
  } catch (err) {
    return `network error: ${err instanceof Error ? err.message : String(err)}`
  }
}

async function main() {
  const token = process.env.MOYSKLAD_TOKEN ?? ''
  console.log(`token present: ${token ? `yes (${token.length} chars)` : 'no'}`)
  if (!token) return

  console.log(`GET /context/employee → ${await status('/context/employee')}`)
  console.log(`GET /entity/product?limit=1 → ${await status('/entity/product?limit=1')}`)
  console.log(`GET /entity/assortment?limit=1 → ${await status('/entity/assortment?limit=1')}`)

  const linked = await prisma.productVariant.findFirst({
    where: { moyskladId: { not: null } },
    select: { moyskladId: true },
  })
  const total = await prisma.productVariant.count({ where: { moyskladId: { not: null } } })
  console.log(`variants linked to МойСклад: ${total}`)
  if (linked?.moyskladId) {
    console.log(`GET /entity/product/{linked}/images → ${await status(`/entity/product/${linked.moyskladId}/images`)}`)
  }
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('probe failed:', err instanceof Error ? err.message : String(err))
})
