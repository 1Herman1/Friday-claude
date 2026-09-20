import type { FastifyInstance } from 'fastify'

export async function logoutRoute(app: FastifyInstance) {
  app.post(
    '/api/v1/auth/logout',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['ok'],
            properties: {
              ok: { type: 'boolean' },
            },
          },
          401: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      // Increment tokenVersion to invalidate all tokens
      const { db } = await import('../../lib/db.js')
      await db.user.update({
        where: { id: request.user!.id },
        data: {
          tokenVersion: { increment: 1 },
        },
      })

      reply.clearCookie('ps_auth', { path: '/' })
      reply.status(200).send({ ok: true })
    }
  )
}
