import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Фирменное оформление плиток брендов на главной. Код заливки давно на боевом
// (client/src/components/home/BrandsSection.tsx), но цвет — данные в записи
// Brand, и на боевой базе их никто не проставлял. Значения ровно те же, что в
// dev-наполнении (prisma/seed.ts), поэтому локально и на боевом плитка
// выглядит одинаково.
const IDENTITY: Array<{ slug: string; accentColor: string; logoFit: string }> = [
  { slug: 'farmina', accentColor: '#0F70B5', logoFit: 'mark' },
]

async function main() {
  const apply = process.argv.includes('--apply')

  let changed = 0
  let skipped = 0

  for (const identity of IDENTITY) {
    const brand = await prisma.brand.findUnique({
      where: { slug: identity.slug },
      select: { slug: true, name: true, accentColor: true, logoFit: true },
    })

    if (!brand) {
      console.log(`${identity.slug}: бренда нет в базе — пропуск`)
      skipped++
      continue
    }

    // Заполняем только пустое: значение, выставленное владельцем в админке,
    // важнее списка в этом скрипте.
    const data: Record<string, string> = {}
    if (brand.accentColor === null) data.accentColor = identity.accentColor
    if (brand.logoFit === null) data.logoFit = identity.logoFit

    if (Object.keys(data).length === 0) {
      console.log(`${brand.name}: уже заполнено (${brand.accentColor}, ${brand.logoFit}) — пропуск`)
      skipped++
      continue
    }

    if (apply) {
      await prisma.brand.update({ where: { slug: identity.slug }, data })
      console.log(`${brand.name}: записано ${JSON.stringify(data)}`)
    } else {
      console.log(`${brand.name}: будет записано ${JSON.stringify(data)}`)
    }
    changed++
  }

  console.log(`\n${apply ? 'Изменено' : 'К изменению'}: ${changed}, пропущено: ${skipped}`)
  if (!apply && changed > 0) {
    console.log('Это был пробный прогон. Для записи добавьте флаг --apply')
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Ошибка:', err)
  process.exit(1)
})
