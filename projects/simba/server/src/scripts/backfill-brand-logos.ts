import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  const apply = process.argv.includes('--apply')
  const dir = path.resolve(__dirname, '../../../client/public/brands')

  if (!fs.existsSync(dir)) {
    console.log(`Папка не найдена: ${dir}`)
    await prisma.$disconnect()
    return
  }

  const brands = await prisma.brand.findMany({ where: { logo: null }, orderBy: { slug: 'asc' } })

  let updated = 0
  let fileExists = 0
  let skipped = 0

  for (const b of brands) {
    const filePath = path.join(dir, `${b.slug}.png`)

    // Проверяем есть ли файл
    if (!fs.existsSync(filePath)) {
      console.log(`${b.slug}: файла нет — пропуск`)
      skipped++
      continue
    }

    // Обновляем
    if (apply) {
      await prisma.brand.update({
        where: { id: b.id },
        data: { logo: `/brands/${b.slug}.png` },
      })
      console.log(`${b.slug}: файл есть → проставлен`)
    } else {
      console.log(`${b.slug}: файл есть → будет проставлен`)
    }
    fileExists++
    updated++
  }

  console.log(`\nБрендов с пустым логотипом: ${brands.length}`)
  console.log(`Файл есть: ${fileExists}, пропуск: ${skipped}`)
  console.log(`${apply ? 'Обновлено' : 'К обновлению'}: ${updated}`)

  if (!apply && updated > 0) {
    console.log('Это был пробный прогон. Для записи добавьте флаг --apply')
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Ошибка:', err)
  process.exit(1)
})
