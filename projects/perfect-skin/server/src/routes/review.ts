import type { FastifyInstance } from 'fastify'
import { ApiError } from '../lib/errors.js'
import { createTokenHash } from '../lib/crypto.js'
import { readStoredFile } from '../lib/pro-docs.js'
import { proDocs } from '../lib/env.js'

/**
 * Одноразовый просмотр заявки специалиста по ссылке из Telegram.
 * Не требует авторизации.
 */
export async function reviewRoutes(app: FastifyInstance) {
  // GET /api/v1/review/:token
  app.get(
    '/review/:token',
    {
      schema: {
        response: {
          200: {
            type: 'string',
            contentType: 'text/html',
          },
          404: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string }

      // Валидируем токен формата base64url
      if (!/^[A-Za-z0-9_-]+$/.test(token)) {
        throw new ApiError(404, 'TOKEN_NOT_FOUND', 'Токен не найден')
      }

      const tokenHash = await createTokenHash(token)

      // Атомарно проверяем, что токен валиден и есть лимит, затем увеличиваем counter
      // Использование 8 = страница (1) + изображение сертификата (1) + иные доказательства (до 6)
      const viewToken = await app.prisma.docViewToken.findFirst({
        where: {
          tokenHash,
          expiresAt: { gt: new Date() },
          uses: { lt: 8 },
        },
        select: {
          applicantId: true,
        },
      })

      if (!viewToken) {
        throw new ApiError(404, 'TOKEN_NOT_FOUND', 'Токен не найден')
      }

      // Увеличиваем счётчик использований
      const updateResult = await app.prisma.docViewToken.updateMany({
        where: {
          tokenHash,
          uses: { lt: 8 },
          expiresAt: { gt: new Date() },
        },
        data: { uses: { increment: 1 } },
      })

      // Если updateMany вернул 0, значит между findFirst и updateMany кто-то исчерпал лимит
      if (updateResult.count !== 1) {
        throw new ApiError(404, 'TOKEN_NOT_FOUND', 'Токен не найден')
      }

      // Получаем данные заявки
      const applicant = await app.prisma.user.findUnique({
        where: { id: viewToken.applicantId },
        select: {
          name: true,
          companyName: true,
          inn: true,
          ogrnip: true,
          specialization: true,
          proStatus: true,
          proRequestedAt: true,
          proDocuments: {
            select: { mime: true, uploadedAt: true, storageKey: true },
            orderBy: { uploadedAt: 'desc' },
            take: 1,
          },
        },
      })

      if (!applicant) {
        throw new ApiError(404, 'APPLICANT_NOT_FOUND', 'Заявитель не найден')
      }

      // Получаем инфо из реестра МСП
      const registryProfile = applicant.inn
        ? await app.prisma.registryProfile.findUnique({
            where: { inn: applicant.inn },
            select: { name: true, okvedMain: true, okveds: true },
          })
        : null

      // Считаем дубликаты ИНН
      let innDuplicates = { pending: 0, approved: 0 }
      if (applicant.inn) {
        [innDuplicates.pending, innDuplicates.approved] = await Promise.all([
          app.prisma.user.count({
            where: { inn: applicant.inn, deletedAt: null, proStatus: 'pending' },
          }),
          app.prisma.user.count({
            where: { inn: applicant.inn, deletedAt: null, proStatus: 'approved' },
          }),
        ])
      }

      // Генерируем HTML
      const htmlEscape = (str: string | null | undefined) => {
        if (!str) return ''
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
      }

      const hasDocument = applicant.proDocuments.length > 0 && applicant.proDocuments[0].storageKey

      const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Заявка специалиста</title>
  <meta name="robots" content="noindex">
  <meta name="referrer" content="no-referrer">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { font-size: 20px; margin-bottom: 20px; }
    .section { margin-bottom: 20px; }
    .field { margin-bottom: 12px; }
    .label { font-weight: 600; font-size: 12px; color: #666; }
    .value { margin-top: 4px; font-size: 14px; word-break: break-word; }
    .image { max-width: 100%; height: auto; border: 1px solid #ddd; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Заявка специалиста</h1>

    <div class="section">
      <div class="field">
        <div class="label">Имя</div>
        <div class="value">${htmlEscape(applicant.name)}</div>
      </div>
      <div class="field">
        <div class="label">ИНН</div>
        <div class="value">${htmlEscape(applicant.inn)}</div>
      </div>
      <div class="field">
        <div class="label">ОГРНИП</div>
        <div class="value">${htmlEscape(applicant.ogrnip)}</div>
      </div>
      <div class="field">
        <div class="label">Название компании</div>
        <div class="value">${htmlEscape(applicant.companyName)}</div>
      </div>
      <div class="field">
        <div class="label">Специализация</div>
        <div class="value">${htmlEscape(applicant.specialization)}</div>
      </div>
    </div>

    ${registryProfile
      ? `<div class="section">
      <h2 style="font-size: 16px; margin-bottom: 12px;">Реестр МСП</h2>
      <div class="field">
        <div class="label">Название в реестре</div>
        <div class="value">${htmlEscape(registryProfile.name)}</div>
      </div>
      <div class="field">
        <div class="label">Основной ОКВЭД</div>
        <div class="value">${htmlEscape(registryProfile.okvedMain)}</div>
      </div>
    </div>`
      : ''
    }

    <div class="section">
      <div class="field">
        <div class="label">Статус заявки</div>
        <div class="value">${htmlEscape(applicant.proStatus)}</div>
      </div>
      <div class="field">
        <div class="label">Подана</div>
        <div class="value">${applicant.proRequestedAt?.toLocaleString('ru-RU') || '-'}</div>
      </div>
      ${innDuplicates.pending > 0 || innDuplicates.approved > 0
        ? `<div class="field">
        <div class="label">Дубликаты этого ИНН</div>
        <div class="value">На рассмотрении: ${innDuplicates.pending}, Одобрено: ${innDuplicates.approved}</div>
      </div>`
        : ''
      }
    </div>

    ${hasDocument
      ? `<div class="section">
      <h2 style="font-size: 16px; margin-bottom: 12px;">Документ</h2>
      ${applicant.proDocuments[0].mime === 'application/pdf'
        ? `<a href="/api/v1/review/${token}/file" style="display: inline-block; padding: 8px 16px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">Скачать PDF</a>`
        : `<img src="/api/v1/review/${token}/file" alt="Документ" class="image">`
      }
    </div>`
      : ''
    }
  </div>
</body>
</html>`

      reply.header('Cache-Control', 'no-store')
      reply.header('X-Robots-Tag', 'noindex')
      reply.header('Referrer-Policy', 'no-referrer')
      reply.header('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'")
      reply.header('X-Content-Type-Options', 'nosniff')
      reply.type('text/html').send(html)
    }
  )

  // GET /api/v1/review/:token/file
  app.get(
    '/review/:token/file',
    {
      schema: {
        response: {
          200: {
            type: 'string',
            format: 'binary',
          },
          404: { $ref: 'ps.error#' },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string }

      if (!/^[A-Za-z0-9_-]+$/.test(token)) {
        throw new ApiError(404, 'TOKEN_NOT_FOUND', 'Токен не найден')
      }

      const tokenHash = await createTokenHash(token)

      // Атомарно проверяем, что токен валиден и есть лимит, затем увеличиваем counter
      const viewToken = await app.prisma.docViewToken.findFirst({
        where: {
          tokenHash,
          expiresAt: { gt: new Date() },
          uses: { lt: 8 },
        },
        select: {
          applicantId: true,
        },
      })

      if (!viewToken) {
        throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Документ удалён по сроку хранения')
      }

      // Увеличиваем счётчик использований
      const updateResult = await app.prisma.docViewToken.updateMany({
        where: {
          tokenHash,
          uses: { lt: 8 },
          expiresAt: { gt: new Date() },
        },
        data: { uses: { increment: 1 } },
      })

      // Если updateMany вернул 0, значит между findFirst и updateMany кто-то исчерпал лимит
      if (updateResult.count !== 1) {
        throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Документ удалён по сроку хранения')
      }

      // Получаем документ
      const doc = await app.prisma.proDocument.findFirst({
        where: {
          userId: viewToken.applicantId,
          storageKey: { not: null },
        },
        orderBy: { uploadedAt: 'desc' },
      })

      if (!doc || !doc.storageKey) {
        throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Документ удалён по сроку хранения')
      }

      // Читаем файл
      const fileBuffer = await readStoredFile(proDocs, doc.storageKey)

      reply.header('Content-Type', doc.mime)
      reply.header('Cache-Control', 'no-store')
      reply.header('X-Content-Type-Options', 'nosniff')
      reply.header('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox")

      const disposition = doc.mime === 'application/pdf' ? 'attachment' : 'inline'
      reply.header('Content-Disposition', `${disposition}; filename="document"`)

      reply.type(doc.mime).send(fileBuffer)
    }
  )
}
