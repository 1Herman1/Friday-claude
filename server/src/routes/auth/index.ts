import { FastifyPluginAsync } from 'fastify'
import sendOtp from './send-otp'
import verifyOtp from './verify-otp'
import guestSession from './guest-session'
import adminLogin from './admin-login'
import me from './me'
import changePassword from './change-password'
import account from './account'

const authRoutes: FastifyPluginAsync = async (app) => {
  app.register(sendOtp)
  app.register(verifyOtp)
  app.register(guestSession)
  app.register(adminLogin)
  app.register(me)
  app.register(changePassword)
  app.register(account)
}

export default authRoutes
