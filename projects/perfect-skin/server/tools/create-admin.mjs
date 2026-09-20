// Создание администратора
// Использование: node tools/create-admin.mjs email@example.com super_admin
// Роли: super_admin, orders_manager, products_manager, content_manager
import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'

const prisma = new PrismaClient()

const VALID_ROLES = ['super_admin', 'orders_manager', 'products_manager', 'content_manager']

async function createAdmin(email, role) {
  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    console.error(`❌ Ошибка: некорректный email "${email}"`)
    process.exitCode = 1
    return
  }

  // Validate role
  if (!VALID_ROLES.includes(role)) {
    console.error(`❌ Ошибка: неизвестная роль "${role}"`)
    console.error(`   Доступные роли: ${VALID_ROLES.join(', ')}`)
    process.exitCode = 1
    return
  }

  try {
    // Find existing user by email
    const existing = await prisma.user.findFirst({
      where: { email },
    })

    let user
    if (existing) {
      // Update existing user
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          role,
          isActive: true,
        },
      })
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email,
          name: email.split('@')[0],
          role,
          isActive: true,
        },
      })
    }

    console.log(`✅ Администратор успешно создан/обновлён:`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Роль: ${user.role}`)
    console.log(`   Активен: ${user.isActive}`)
  } catch (e) {
    console.error('❌ Ошибка при создании администратора:', e.message)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

// Get args
const args = process.argv.slice(2)
if (args.length !== 2) {
  console.error('Использование: node tools/create-admin.mjs <email> <role>')
  console.error('Пример: node tools/create-admin.mjs admin@example.com super_admin')
  process.exitCode = 1
  process.exit()
}

createAdmin(args[0], args[1])
