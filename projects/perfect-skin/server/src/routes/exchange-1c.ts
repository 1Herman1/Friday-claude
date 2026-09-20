import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fastifyPlugin from 'fastify-plugin'
import { db } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'
import { exchange1cService } from '../services/exchange-1c.service.js'

/**
 * Обмен с 1С по стандартному протоколу «Обмен с сайтом» (CommerceML 2).
 * HTTP Basic авторизация по PS_1C_LOGIN и PS_1C_PASSWORD.
 *
 * GET/POST /exchange/1c?type=catalog&mode=checkauth|init|file|import
 * GET       /exchange/1c?type=sale&mode=query
 * POST      /exchange/1c?type=sale&mode=success
 */

function checkBasicAuth(request: FastifyRequest): boolean {
  const login = process.env.PS_1C_LOGIN
  const password = process.env.PS_1C_PASSWORD

  if (!login || !password) {
    return false
  }

  const auth = request.headers.authorization
  if (!auth || !auth.startsWith('Basic ')) {
    return false
  }

  const encoded = auth.substring(6)
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
  const [user, pass] = decoded.split(':')

  return user === login && pass === password
}

interface Exchange1CQueryString {
  type?: string
  mode?: string
  filename?: string
}

export default fastifyPlugin(async (app: FastifyInstance) => {
  // 1С шлёт XML (или без Content-Type) — дефолтный JSON-парсер Fastify
  // такие тела отверг бы с 415, поэтому принимаем их сырой строкой.
  for (const type of ['application/xml', 'text/xml', 'text/plain', 'application/octet-stream']) {
    if (!app.hasContentTypeParser(type)) {
      app.addContentTypeParser(type, { parseAs: 'string' }, (_req, body, done) => done(null, body))
    }
  }

  // GET /exchange/1c — обработка всех режимов
  app.get<{ Querystring: Exchange1CQueryString }>(
    '/exchange/1c',
    async (request: FastifyRequest<{ Querystring: Exchange1CQueryString }>, reply: FastifyReply) => {
      const { type, mode } = request.query

      // Проверка авторизации
      if (!checkBasicAuth(request)) {
        return reply.status(403).send('failure\nAccess denied')
      }

      // mode=checkauth
      if (mode === 'checkauth') {
        try {
          await db.syncLog.create({
            data: {
              direction: 'auth',
              status: 'success',
              itemsCount: 0,
            },
          })
        } catch {
          // игнорируем ошибки логирования
        }
        return reply.type('text/plain').send('success\nPHPSESSID\n')
      }

      // mode=init
      if (mode === 'init') {
        return reply.type('text/plain').send('zip=no\nfile_limit=10000000')
      }

      // type=sale&mode=query — выгрузка заказов
      if (type === 'sale' && mode === 'query') {
        try {
          const xml = await exchange1cService.exportOrders()
          return reply.type('application/xml; charset=utf-8').send(xml)
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          app.log.error({ error }, 'Export orders failed')
          return reply.type('text/plain').send(`failure\n${msg}`)
        }
      }

      return reply.status(400).type('text/plain').send('failure\nUnknown mode')
    }
  )

  // POST /exchange/1c — загрузка и импорт
  app.post<{ Querystring: Exchange1CQueryString }>(
    '/exchange/1c',
    {},
    async (request: FastifyRequest<{ Querystring: Exchange1CQueryString }>, reply: FastifyReply) => {
      const { type, mode, filename } = request.query

      // Проверка авторизации
      if (!checkBasicAuth(request)) {
        return reply.status(403).send('failure\nAccess denied')
      }

      // mode=file — сохранение XML
      if (mode === 'file') {
        try {
          const body = request.body as string | Buffer
          const content = typeof body === 'string' ? body : body.toString('utf-8')

          const safeFilename = filename ? filename.replace(/[^a-zA-Z0-9._-]/g, '_') : 'upload.xml'
          exchange1cService.saveXmlFile(safeFilename, content)

          return reply.type('text/plain').send('success')
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          app.log.error({ error }, 'File save failed')
          return reply.type('text/plain').send(`failure\n${msg}`)
        }
      }

      // mode=import — применение загруженного XML
      if (mode === 'import') {
        try {
          const body = request.body as string | Buffer
          const content = typeof body === 'string' ? body : body.toString('utf-8')

          const result = await exchange1cService.importCatalog(content)

          await db.syncLog.create({
            data: {
              direction: 'import',
              status: 'success',
              itemsCount: result.imported,
              errorText: result.skipped > 0 ? `${result.skipped} items skipped` : null,
            },
          })

          return reply.type('text/plain').send('success')
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          app.log.error({ error }, 'Import failed')

          try {
            await db.syncLog.create({
              data: {
                direction: 'import',
                status: 'failed',
                itemsCount: 0,
                errorText: msg,
              },
            })
          } catch {
            // игнорируем ошибки логирования
          }

          return reply.type('text/plain').send(`failure\n${msg}`)
        }
      }

      // type=sale&mode=success
      if (type === 'sale' && mode === 'success') {
        try {
          await db.syncLog.create({
            data: {
              direction: 'export',
              status: 'success',
              itemsCount: 0,
            },
          })
        } catch {
          // игнорируем ошибки логирования
        }
        return reply.type('text/plain').send('success')
      }

      return reply.status(400).type('text/plain').send('failure\nUnknown mode')
    }
  )
})
