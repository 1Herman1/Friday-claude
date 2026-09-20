import { PrismaClient } from '@prisma/client'

export async function findAdminByUsername(prisma: PrismaClient, username: string) {
  return await prisma.user.findUnique({
    where: { username },
  })
}
