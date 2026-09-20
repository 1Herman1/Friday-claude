import type { FastifyInstance } from 'fastify'
import fastifyPlugin from 'fastify-plugin'
import { sendOtpRoute } from './send-otp.js'
import { verifyOtpRoute } from './verify-otp.js'
import { meRoute } from './me.js'
import { logoutRoute } from './logout.js'

export default fastifyPlugin(async (app: FastifyInstance) => {
  await sendOtpRoute(app)
  await verifyOtpRoute(app)
  await meRoute(app)
  await logoutRoute(app)
})
