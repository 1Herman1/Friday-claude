import type { FastifyInstance } from 'fastify'

export async function meRoute(app: FastifyInstance) {
  app.get(
    '/api/v1/auth/me',
    {
      schema: {
        response: {
          200: { $ref: 'ps.user#' },
          401: { $ref: 'ps.error#' },
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      reply.status(200).send({
        id: request.user!.id,
        name: request.user!.name,
        phone: request.user!.phone,
        email: request.user!.email,
        role: request.user!.role,
      })
    }
  )
}
