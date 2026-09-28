// Логин и пароль сотрудника для входа в админку.
// Использование: PS_ADMIN_PASSWORD=... node tools/set-staff-password.mjs admin super_admin
// Пароль берётся только из окружения, чтобы не оседать в истории команд и логах.
import bcryptjs from 'bcryptjs'
import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'

const VALID_ROLES = ['super_admin', 'orders_manager', 'products_manager', 'content_manager']
const [login, role] = process.argv.slice(2)
const password = process.env.PS_ADMIN_PASSWORD || ''

if (!login || !/^[a-z0-9._-]{3,64}$/.test(login) || !VALID_ROLES.includes(role)) {
  console.error('Использование: node tools/set-staff-password.mjs <login> <role>')
  process.exit(1)
}
if (password.length < 12) {
  console.error('PS_ADMIN_PASSWORD не задан или короче 12 символов')
  process.exit(1)
}

const prisma = new PrismaClient()
try {
  const passwordHash = await bcryptjs.hash(password, 12)
  await prisma.user.upsert({
    where: { login },
    update: { passwordHash, role, isActive: true, tokenVersion: { increment: 1 } },
    create: { login, name: login, passwordHash, role, isActive: true },
  })
  console.log('ok')
} catch (e) {
  console.error('Ошибка:', e.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
