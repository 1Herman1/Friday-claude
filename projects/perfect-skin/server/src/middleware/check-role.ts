import type { FastifyRequest, FastifyReply } from 'fastify'
import { type UserRole } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'

export function checkRole(roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Требуется авторизация')
    }

    if (!roles.includes(request.user.role as UserRole)) {
      throw new ApiError(403, 'FORBIDDEN', 'Недостаточно прав')
    }
  }
}
