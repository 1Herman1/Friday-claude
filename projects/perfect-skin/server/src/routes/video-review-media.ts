import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { isPublishableFile } from '../services/video-review.service.js'
import { videoReviewsDir } from '../lib/env.js'
import { ApiError } from '../lib/errors.js'

const STAFF_ROLES = ['super_admin', 'content_manager']
const fileName = z.string().regex(/^[0-9a-f-]{36}\.(mp4|webm|jpg)$/)

interface MediaOptions {
  /** Без Nginx (разработка): отдаём файл сами. В боевом окружении Nginx отдаёт его по X-Accel-Redirect. */
  streamLocally: boolean
}

function contentTypeOf(name: string): string {
  if (name.endsWith('.jpg')) return 'image/jpeg'
  return name.endsWith('.webm') ? 'video/webm' : 'video/mp4'
}

// Медиа отзывов не лежит под статикой: показ решает приложение, Nginx отдаёт файл по внутреннему адресу.
// Чужой или неопубликованный файл — 404, а не 403: не раскрываем, что он существует.
export default async function videoReviewMediaRoutes(app: FastifyInstance, options: MediaOptions) {
  app.get<{ Params: { file: string } }>(
    '/uploads/video-reviews/:file',
    {
      preHandler: app.authenticateOptional,
      config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = fileName.safeParse(request.params.file)
      if (!parsed.success) throw new ApiError(404, 'NOT_FOUND', 'Файл не найден')
      const name = parsed.data

      const isStaff = request.user !== undefined && STAFF_ROLES.includes(request.user.role)
      if (!isStaff && !(await isPublishableFile(name))) throw new ApiError(404, 'NOT_FOUND', 'Файл не найден')

      const headers = {
        'Content-Type': contentTypeOf(name),
        'Cache-Control': isStaff ? 'private, no-store' : 'public, max-age=300',
      }

      if (!options.streamLocally) {
        reply.headers(headers)
        reply.header('X-Accel-Redirect', `/_protected/video-reviews/${name}`)
        return reply.send()
      }

      const path = join(videoReviewsDir, name)
      try {
        await stat(path)
      } catch {
        throw new ApiError(404, 'NOT_FOUND', 'Файл не найден')
      }
      reply.headers(headers)
      return reply.send(createReadStream(path))
    },
  )
}
