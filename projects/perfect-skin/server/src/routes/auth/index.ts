import type { FastifyInstance } from 'fastify'
import fastifyPlugin from 'fastify-plugin'
import { sendOtpRoute } from './send-otp.js'
import { verifyOtpRoute } from './verify-otp.js'
import { meRoute } from './me.js'
import { marketingConsentRoute } from './marketing.js'
import { logoutRoute } from './logout.js'
import { staffLoginRoute } from './staff-login.js'

export default fastifyPlugin(async (app: FastifyInstance) => {
  await sendOtpRoute(app)
  await verifyOtpRoute(app)
  await meRoute(app)
  await marketingConsentRoute(app)
  await logoutRoute(app)
  await staffLoginRoute(app)
})
