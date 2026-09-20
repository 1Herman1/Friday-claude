import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
const { sign } = jwt
import { otpService } from '../../services/otp.service.js'
import { cartService } from '../../services/cart.service.js'
import { ApiError } from '../../lib/errors.js'

const verifySchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(254),
  code: z
    .string()
    .regex(/^\d{6}$/, 'Код должен быть 6 цифр'),
})

export async function verifyOtpRoute(app: FastifyInstance) {
  app.post<{ Body: { email: string; code: string } }>(
    '/api/v1/auth/verify-otp',
    {
      // Лимит по email, не по IP: перебор кода с многих адресов параллелен.
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
          keyGenerator: (req: FastifyRequest) =>
            (req.body as { email?: string } | null)?.email ?? req.ip,
        },
      },
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['token', 'user', 'cartMerged'],
            properties: {
              token: { type: 'string' },
              user: { $ref: 'ps.user#' },
              cartMerged: { type: 'boolean' },
            },
          },
          400: { $ref: 'ps.error#' },
          429: { $ref: 'ps.error#' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Validate input
      const result = verifySchema.safeParse(request.body)
      if (!result.success) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Неверный код или email',
          { field: result.error.issues[0]?.path[0] }
        )
      }

      const { email, code } = result.data

      // Verify OTP code
      await otpService.verifyCode(email, code)

      // Get or create user
      const user = await otpService.findOrCreateUser(email)

      // Merge guest cart into user cart (inside transaction for atomicity)
      const psidCookie = (request.cookies as any)?.ps_sid
      const sessionId = psidCookie ? request.unsignCookie(psidCookie)?.value : null
      let cartMerged = false

      if (sessionId) {
        cartMerged = await cartService.mergeGuestCart(user.id, sessionId)
      }

      // Generate JWT token
      const token = sign(
        {
          userId: user.id,
          role: user.role,
          tv: user.tokenVersion,
        },
        process.env.JWT_SECRET || 'dev-secret',
        { expiresIn: '7 days' }
      )

      // Set auth cookie if needed
      reply.setCookie('ps_auth', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 3600,
      })

      reply.status(200).send({
        token,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
        },
        cartMerged,
      })
    }
  )
}
