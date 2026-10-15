import { PrismaClient, Concern } from '../../../../node_modules/.prisma/ps-client/index.js'

// Добавляет товару заботу (Concern). Запуск: --slug=<адрес товара> --concern=<значение enum Concern> [--apply]
function arg(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length)
}

function parseConcern(value: string | undefined): Concern {
  const all = Object.values(Concern) as string[]
  if (!value || !all.includes(value)) throw new Error(`--concern должен быть одним из: ${all.join(', ')}`)
  return value as Concern
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const slug = arg('slug')
  if (!slug) throw new Error('не указан --slug=<адрес товара>')
  const concern = parseConcern(arg('concern'))

  console.log(`Режим: ${apply ? 'ЗАПИСЬ В БАЗУ' : 'сухой прогон'}`)
  const prisma = new PrismaClient()
  try {
    const rows = await prisma.product.findMany({
      where: { slug, deletedAt: null },
      select: { id: true, name: true, concerns: true },
    })
    if (rows.length !== 1) throw new Error(`ожидался ровно один активный товар ${slug}, найдено ${rows.length}`)
    const product = rows[0]

    const next = product.concerns.includes(concern) ? product.concerns : [...product.concerns, concern]
    const changes = next.length - product.concerns.length
    console.log(`• ${slug} «${product.name}»`)
    console.log(`  было:  [${product.concerns.join(', ')}]`)
    console.log(`  стало: [${next.join(', ')}]`)
    console.log(`\nИтог: изменений ${changes}`)

    if (!apply) {
      console.log('\nСухой прогон: ничего не записано. Для записи — с флагом --apply.')
      return
    }
    if (changes === 0) {
      console.log('Записывать нечего.')
      return
    }

    await prisma.$transaction([prisma.product.update({ where: { id: product.id }, data: { concerns: next } })])
    console.log(`Записано: ${changes}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Ошибка:', error instanceof Error ? error.message : error)
  process.exit(1)
})
