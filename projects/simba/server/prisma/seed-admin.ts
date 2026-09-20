import { PrismaClient, UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD

  if (!username) {
    console.error('❌ ADMIN_USERNAME не установлена')
    process.exit(1)
  }

  if (!password) {
    console.error('❌ ADMIN_PASSWORD не установлена')
    process.exit(1)
  }

  console.log(`Setting up admin: ${username}...`)

  const passwordHash = await bcrypt.hash(password, 10)

  const admin = await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: {
      username,
      passwordHash,
      email: `${username}@admin.local`,
      name: 'Администратор Simba',
      role: UserRole.super_admin,
      isActive: true,
    },
  })

  console.log(`✓ Admin user configured: ${admin.id}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
