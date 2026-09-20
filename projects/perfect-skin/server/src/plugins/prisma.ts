import { PrismaClient } from '../lib/db.js'
import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'

let prisma: PrismaClient

async function prismaPlugin(fastify: FastifyInstance) {
  prisma = new PrismaClient()

  await prisma.$connect()

  fastify.decorate('prisma', prisma)

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect()
  })
}

export default fp(prismaPlugin, {
  name: 'prisma',
})

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}
