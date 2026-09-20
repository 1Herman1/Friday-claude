import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import * as bcrypt from 'bcryptjs'

const bodySchema = z.object({
  currentPassword: z.string().min(1, 'Текущий пароль обязателен'),
  newPassword: z.string().min(8, 'Новый пароль минимум 8 символов'),
})

const changePassword: FastifyPluginAsync = async (app) => {
  app.post<{ Body: z.infer<typeof bodySchema> }>(
    '/change-password',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const result = bodySchema.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message })
      }

      const { currentPassword, newPassword } = result.data
      const { userId } = request.user

      const user = await app.prisma.user.findUnique({ where: { id: userId } })

      if (!user || !user.passwordHash) {
        return reply.status(400).send({ error: 'Пользователь не найден или пароль не установлен' })
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!isCurrentPasswordValid) {
        return reply.status(400).send({ error: 'Текущий пароль неверен' })
      }

      const passwordHash = await bcrypt.hash(newPassword, 10)
      await app.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      })

      return reply.send({ message: 'Пароль успешно изменён' })
    }
  )
}

export default changePassword
