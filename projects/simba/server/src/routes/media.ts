import { FastifyInstance } from 'fastify'
import { getFileStream, fileExists } from '../lib/storage'

export default async function mediaRoute(app: FastifyInstance) {
  app.get<{ Params: { key: string } }>(
    '/:key',
    async (request, reply) => {
      const { key } = request.params

      // Санитизация: только alphanumeric, точка и дефис/подчеркивание
      if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
        return reply.status(400).send({ error: 'Invalid file key' })
      }

      const exists = await fileExists(key)
      if (!exists) {
        return reply.status(404).send({ error: 'File not found' })
      }

      try {
        const stream = await getFileStream(key)

        // Если это изображение, то Content-Type из расширения. При наличии Content-Type в объекте —
        // можно было бы вернуть его, но для простоты определяем по расширению.
        const ext = key.split('.').pop()?.toLowerCase() || 'bin'
        const contentType = contentTypeFromExt(ext)

        // Кэш на год (файл именован по хешу, содержимое не меняется)
        reply.header('Cache-Control', 'public, max-age=31536000, immutable')
        reply.header('Content-Type', contentType)

        // return обязателен: без него асинхронный обработчик завершается со
        // значением undefined, Fastify считает это ответом и отдаёт пустое
        // тело. Заголовки при этом приходят верные, поэтому браузер показывал
        // «битую картинку» при полностью исправном хранилище.
        return reply.send(stream)
      } catch (err) {
        // Без записи в журнал отказ хранилища выглядел бы как «картинка не
        // грузится», и причину пришлось бы искать вслепую.
        app.log.error({ err, key }, 'Не удалось отдать файл из хранилища')
        return reply.status(500).send({ error: 'Failed to retrieve file' })
      }
    },
  )
}

function contentTypeFromExt(ext: string): string {
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  }
  return types[ext] || 'application/octet-stream'
}
