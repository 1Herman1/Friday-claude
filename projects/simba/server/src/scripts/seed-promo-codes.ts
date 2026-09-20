import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Исторический промокод SIMBA10 от основания проекта
const PROMO_CODES = [
  {
    code: 'SIMBA10',
    type: 'percent' as const,
    value: 10,
    isActive: true,
    comment: 'Исторический код с сайта',
  },
]

async function main() {
  const apply = process.argv.includes('--apply')

  let created = 0
  let skipped = 0

  for (const p of PROMO_CODES) {
    const existing = await prisma.promoCode.findUnique({ where: { code: p.code }, select: { code: true } })

    // Только создание: промокод, который уже в базе, скрипт не перетирает
    if (existing) {
      console.log(`${p.code}: уже есть — пропуск`)
      skipped++
      continue
    }

    if (apply) {
      await prisma.promoCode.create({
        data: p,
      })
      console.log(`${p.code}: создан`)
    } else {
      console.log(`${p.code}: будет создан`)
    }
    created++
  }

  console.log(`\n${apply ? 'Создано' : 'К созданию'}: ${created}, пропущено: ${skipped}`)
  if (!apply && created > 0) {
    console.log('Это был пробный прогон. Для записи добавьте флаг --apply')
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Ошибка:', err)
  process.exit(1)
})
