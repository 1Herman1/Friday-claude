import { FastifyRequest, FastifyReply } from 'fastify'
import { UserRole } from '../types'

export function checkRole(roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(request.user.role)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
  }
}
