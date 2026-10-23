import { execFile } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { chmod, mkdir, open, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { pipeline } from 'node:stream/promises'
import type { FastifyBaseLogger } from 'fastify'
import type { MultipartFile } from '@fastify/multipart'
import { db, type Prisma } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'
import { videoConsentsDir, videoReviewsDir } from '../lib/env.js'
import { isFileSafeToDelete } from '../lib/safe-file-ops.js'
import { stripJpegMetadata } from '../lib/pro-docs.js'
import { ACTIVE, productVisibleFor } from '../lib/prisma-filters.js'
import { inspectMp4, sniffConsentDoc, sniffPoster, sniffVideo, type VideoExt } from '../lib/media-sniff.js'

export const MEDIA_SLOTS = ['mp4', 'webm', 'poster'] as const
export type MediaSlot = (typeof MEDIA_SLOTS)[number]

export const MEDIA_LIMIT_BYTES: Record<MediaSlot, number> = {
  mp4: 60 * 1024 * 1024,
  webm: 60 * 1024 * 1024,
  poster: 3 * 1024 * 1024,
}
export const CONSENT_DOC_LIMIT_BYTES = 10 * 1024 * 1024

const PUBLIC_PREFIX = '/uploads/video-reviews/'
const FFMPEG_TIMEOUT_MS = 120_000
const execFileAsync = promisify(execFile)

const ADMIN_INCLUDE = {
  product: { select: { id: true, slug: true, name: true } },
  consentConfirmedBy: { select: { id: true, name: true } },
} satisfies Prisma.VideoReviewInclude

type AdminRow = Prisma.VideoReviewGetPayload<{ include: typeof ADMIN_INCLUDE }>

export type PublishBlocker = 'mp4' | 'poster' | 'consent' | 'consentDoc' | 'site' | 'review' | 'revoked' | 'expired'

interface PublishState {
  mp4Url: string | null
  posterUrl: string | null
  consentConfirmed: boolean
  consentDocPath: string | null
  consentAllowSite: boolean
  contentReviewed: boolean
  consentRevokedAt: Date | null
  consentExpiresAt: Date | null
}

export interface VideoReviewPatch {
  authorName?: string
  caption?: string | null
  productId?: string | null
  consentNote?: string | null
  consentTemplateVersion?: string | null
  consentAllowSite?: boolean
  consentAllowSocial?: boolean
  consentAllowAds?: boolean
  consentExpiresAt?: Date | null
  consentConfirmed?: boolean
  contentReviewed?: boolean
  consentRevoked?: true
  isActive?: boolean
}

export interface VideoReviewCreate {
  authorName: string
  caption?: string | null
  productId?: string | null
  consentNote?: string | null
  consentTemplateVersion?: string | null
}

/** Причины, по которым отзыв нельзя опубликовать. Единственное место, где они перечислены. */
export function publishBlockers(state: PublishState, now: Date): PublishBlocker[] {
  const blockers: PublishBlocker[] = []
  if (!state.mp4Url) blockers.push('mp4')
  if (!state.posterUrl) blockers.push('poster')
  if (!state.consentConfirmed) blockers.push('consent')
  if (!state.consentDocPath) blockers.push('consentDoc')
  if (!state.consentAllowSite) blockers.push('site')
  if (!state.contentReviewed) blockers.push('review')
  if (state.consentRevokedAt) blockers.push('revoked')
  if (state.consentExpiresAt && state.consentExpiresAt <= now) blockers.push('expired')
  return blockers
}

/** Те же условия, что publishBlockers, в виде условия выборки: срок сравнивается с now. */
function readyWhere(now: Date): Prisma.VideoReviewWhereInput {
  return {
    deletedAt: null,
    consentConfirmed: true,
    consentDocPath: { not: null },
    consentAllowSite: true,
    consentRevokedAt: null,
    contentReviewed: true,
    mp4Url: { not: null },
    posterUrl: { not: null },
    OR: [{ consentExpiresAt: null }, { consentExpiresAt: { gt: now } }],
  }
}

function toAdmin(row: AdminRow) {
  const blockers = publishBlockers(row, new Date())
  return {
    id: row.id,
    authorName: row.authorName,
    caption: row.caption,
    product: row.product,
    mp4Url: row.mp4Url,
    webmUrl: row.webmUrl,
    posterUrl: row.posterUrl,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    publishable: row.isActive && blockers.length === 0,
    publishBlockers: blockers,
    hasConsentDoc: row.consentDocPath !== null,
    consentConfirmed: row.consentConfirmed,
    consentConfirmedAt: row.consentConfirmedAt,
    consentConfirmedBy: row.consentConfirmedBy,
    consentTemplateVersion: row.consentTemplateVersion,
    consentAllowSite: row.consentAllowSite,
    consentAllowSocial: row.consentAllowSocial,
    consentAllowAds: row.consentAllowAds,
    consentExpiresAt: row.consentExpiresAt,
    consentRevokedAt: row.consentRevokedAt,
    consentNote: row.consentNote,
    contentReviewed: row.contentReviewed,
    contentReviewedAt: row.contentReviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function findActive(id: string) {
  const row = await db.videoReview.findFirst({ where: { id, deletedAt: null } })
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Отзыв не найден')
  return row
}

async function assertProductExists(productId: string) {
  const product = await db.product.findFirst({ where: { id: productId, deletedAt: null }, select: { id: true } })
  if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Товар не найден')
}

function slotUrl(row: { mp4Url: string | null; webmUrl: string | null; posterUrl: string | null }, slot: MediaSlot) {
  if (slot === 'mp4') return row.mp4Url
  if (slot === 'webm') return row.webmUrl
  return row.posterUrl
}

function slotData(slot: MediaSlot, url: string | null): Prisma.VideoReviewUncheckedUpdateInput {
  if (slot === 'mp4') return { mp4Url: url }
  if (slot === 'webm') return { webmUrl: url }
  return { posterUrl: url }
}

function slotWhere(slot: MediaSlot, url: string | null): Prisma.VideoReviewWhereInput {
  if (slot === 'mp4') return { mp4Url: url }
  if (slot === 'webm') return { webmUrl: url }
  return { posterUrl: url }
}

// Кэш «файл принадлежит публикуемому отзыву» для раздачи Range-запросами видео. Сбрасывается при любой правке.
const PUBLISHABLE_CACHE_MS = 30_000
const publishableCache = new Map<string, boolean>()
let publishableCacheUntil = 0

function resetPublishableCache() {
  publishableCache.clear()
  publishableCacheUntil = 0
}

/** Файл принадлежит отзыву, который сейчас публикуется: то же условие, что публичная выдача. */
export async function isPublishableFile(name: string): Promise<boolean> {
  const now = new Date()
  if (now.getTime() >= publishableCacheUntil) {
    publishableCache.clear()
    publishableCacheUntil = now.getTime() + PUBLISHABLE_CACHE_MS
  }
  const cached = publishableCache.get(name)
  if (cached !== undefined) return cached

  const url = `${PUBLIC_PREFIX}${name}`
  const owners = await db.videoReview.count({
    where: { AND: [{ isActive: true }, readyWhere(now), { OR: [{ mp4Url: url }, { webmUrl: url }, { posterUrl: url }] }] },
  })
  const publishable = owners > 0
  publishableCache.set(name, publishable)
  return publishable
}

function tmpDirOf(dir: string) {
  return `${resolve(dir)}.tmp`
}

async function removeFiles(urls: Array<string | null>, log: FastifyBaseLogger) {
  for (const url of urls) {
    if (!url?.startsWith(PUBLIC_PREFIX)) continue
    const name = url.slice(PUBLIC_PREFIX.length)
    if (!isFileSafeToDelete(name, videoReviewsDir)) continue
    try {
      await unlink(join(videoReviewsDir, name))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        log.error({ err: error, file: name }, 'video review file not removed')
      }
    }
  }
}

async function receiveFile(file: MultipartFile, target: string, mode: number): Promise<void> {
  await pipeline(file.file, createWriteStream(target, { flags: 'wx', mode }))
  if (file.file.truncated) throw new ApiError(413, 'FILE_TOO_LARGE', 'Файл слишком большой')
}

async function readHead(path: string, size = 64): Promise<Buffer> {
  const handle = await open(path, 'r')
  try {
    const buf = Buffer.alloc(size)
    const { bytesRead } = await handle.read(buf, 0, size, 0)
    return buf.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

const FFMPEG_INPUT_FORMAT: Record<VideoExt, string> = { mp4: 'mov', webm: 'matroska' }

// РКН: ffmpeg копирует потоки без перекодирования и не переносит метаданные (геолокация, устройство).
// execFile, не shell: имя файла не попадает в командную строку. Любая ошибка — отказ, без оригинала.
// Формат входа задан явно, протокол — только файл: ffmpeg не должен ходить по сети или читать чужие пути.
async function stripVideoMetadata(input: string, output: string, ext: VideoExt): Promise<void> {
  const args = [
    '-v', 'error', '-nostdin', '-protocol_whitelist', 'file',
    '-f', FFMPEG_INPUT_FORMAT[ext], '-i', input,
    '-map_metadata', '-1', '-map_chapters', '-1', '-c', 'copy',
  ]
  if (ext === 'mp4') args.push('-movflags', '+faststart')
  args.push(output)
  try {
    await execFileAsync('ffmpeg', args, { timeout: FFMPEG_TIMEOUT_MS })
    await chmod(output, 0o644)
  } catch (error) {
    await rm(output, { force: true })
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ApiError(500, 'FFMPEG_MISSING', 'На сервере не установлен ffmpeg: обработка ролика невозможна')
    }
    throw new ApiError(422, 'MEDIA_PROCESSING_FAILED', 'Не удалось очистить метаданные ролика. Сохраните его заново как MP4 (H.264)')
  }
}

async function prepareMedia(slot: MediaSlot, raw: string, tmpDir: string): Promise<{ path: string; ext: string }> {
  const head = await readHead(raw)
  if (slot === 'poster') {
    sniffPoster(head)
    const path = join(tmpDir, `${randomUUID()}.jpg`)
    await writeFile(path, stripJpegMetadata(await readFile(raw)), { mode: 0o644 })
    return { path, ext: 'jpg' }
  }

  const kind = sniffVideo(head)
  if (kind !== slot) {
    throw new ApiError(400, 'UNSUPPORTED_FILE', slot === 'mp4' ? 'Для MP4-слота нужен файл MP4 (H.264)' : 'Для WebM-слота нужен файл WebM')
  }
  if (kind === 'mp4') {
    const handle = await open(raw, 'r')
    try {
      const { size } = await handle.stat()
      await inspectMp4(handle, size)
    } finally {
      await handle.close()
    }
  }
  const path = join(tmpDir, `${randomUUID()}.${kind}`)
  await stripVideoMetadata(raw, path, kind)
  return { path, ext: kind }
}

function mediaWarnings(slot: MediaSlot, row: { posterUrl: string | null; webmUrl: string | null }): string[] {
  const warnings: string[] = []
  if (!row.posterUrl) warnings.push('Нет постера: без него отзыв не публикуется')
  if (slot === 'mp4' && !row.webmUrl) warnings.push('Нет WebM-версии: часть браузеров получит только MP4')
  return warnings
}

export async function listAdminVideoReviews() {
  const rows = await db.videoReview.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: ADMIN_INCLUDE,
  })
  return rows.map(toAdmin)
}

export async function getAdminVideoReview(id: string) {
  const row = await db.videoReview.findFirst({ where: { id, deletedAt: null }, include: ADMIN_INCLUDE })
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Отзыв не найден')
  return toAdmin(row)
}

export async function createVideoReview(payload: VideoReviewCreate) {
  if (payload.productId) await assertProductExists(payload.productId)
  const max = await db.videoReview.aggregate({ where: { deletedAt: null }, _max: { sortOrder: true } })

  const row = await db.videoReview.create({
    data: {
      authorName: payload.authorName,
      caption: payload.caption ?? null,
      productId: payload.productId ?? null,
      consentNote: payload.consentNote ?? null,
      consentTemplateVersion: payload.consentTemplateVersion ?? null,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
    include: ADMIN_INCLUDE,
  })
  return toAdmin(row)
}

/** Снятие любого условия публикации в той же записи снимает и саму публикацию: иначе нарушится CHECK в базе. */
function buildUpdate(
  current: { consentConfirmed: boolean; contentReviewed: boolean },
  patch: VideoReviewPatch,
  actorId: string,
  now: Date,
): Prisma.VideoReviewUncheckedUpdateInput {
  const data: Prisma.VideoReviewUncheckedUpdateInput = {}
  if (patch.authorName !== undefined) data.authorName = patch.authorName
  if (patch.caption !== undefined) data.caption = patch.caption
  if (patch.productId !== undefined) data.productId = patch.productId
  if (patch.consentNote !== undefined) data.consentNote = patch.consentNote
  if (patch.consentTemplateVersion !== undefined) data.consentTemplateVersion = patch.consentTemplateVersion
  if (patch.consentAllowSite !== undefined) data.consentAllowSite = patch.consentAllowSite
  if (patch.consentAllowSocial !== undefined) data.consentAllowSocial = patch.consentAllowSocial
  if (patch.consentAllowAds !== undefined) data.consentAllowAds = patch.consentAllowAds
  if (patch.consentExpiresAt !== undefined) data.consentExpiresAt = patch.consentExpiresAt
  // След пишем только при переходе false → true: повторное сохранение формы не переписывает, кто подтвердил.
  if (patch.consentConfirmed === true && !current.consentConfirmed) {
    Object.assign(data, { consentConfirmed: true, consentConfirmedAt: now, consentConfirmedById: actorId })
  } else if (patch.consentConfirmed === false) {
    data.consentConfirmed = false
  }
  if (patch.contentReviewed === true && !current.contentReviewed) {
    Object.assign(data, { contentReviewed: true, contentReviewedAt: now, contentReviewedById: actorId })
  } else if (patch.contentReviewed === false) {
    data.contentReviewed = false
  }
  if (patch.consentRevoked) {
    Object.assign(data, {
      consentRevokedAt: now,
      consentRevokedById: actorId,
      consentConfirmed: false,
      isActive: false,
      mp4Url: null,
      webmUrl: null,
      posterUrl: null,
    })
  }
  const unpublishes =
    patch.isActive === false ||
    patch.consentAllowSite === false ||
    patch.consentConfirmed === false ||
    patch.contentReviewed === false ||
    (patch.consentExpiresAt !== undefined && patch.consentExpiresAt !== null && patch.consentExpiresAt <= now)
  if (unpublishes) data.isActive = false
  return data
}

/**
 * Правки отзыва. Активация проверяется в той же транзакции, что и правки: сначала
 * условие публикуемости из БД (updateMany), при промахе — 409 с перечнем недостающего.
 * Снятие любого условия при активном отзыве снимает публикацию.
 */
export async function updateVideoReview(
  id: string,
  patch: VideoReviewPatch,
  actorId: string,
  log: FastifyBaseLogger,
) {
  if (patch.productId) await assertProductExists(patch.productId)
  const now = new Date()

  const { row, removed } = await db.$transaction(async (tx) => {
    const current = await tx.videoReview.findFirst({ where: { id, deletedAt: null } })
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Отзыв не найден')

    if (patch.consentConfirmed === true) {
      if (!current.consentDocPath) throw new ApiError(409, 'CONSENT_DOC_MISSING', 'Сначала загрузите документ согласия')
      if (current.consentRevokedAt) throw new ApiError(409, 'CONSENT_REVOKED', 'Согласие отозвано: нужен новый документ')
    }

    const next = await tx.videoReview.update({ where: { id }, data: buildUpdate(current, patch, actorId, now) })
    const blockers = publishBlockers(next, now)

    if (patch.isActive === true) {
      const activated = await tx.videoReview.updateMany({
        where: { id, ...readyWhere(now) },
        data: { isActive: true },
      })
      if (activated.count === 0) {
        throw new ApiError(409, 'VIDEO_NOT_READY', 'Отзыв не готов к публикации', { missing: blockers })
      }
    } else if (next.isActive && blockers.length > 0) {
      await tx.videoReview.update({ where: { id }, data: { isActive: false } })
    }

    const updated = await tx.videoReview.findUniqueOrThrow({ where: { id }, include: ADMIN_INCLUDE })
    const removedUrls = patch.consentRevoked ? [current.mp4Url, current.webmUrl, current.posterUrl] : []
    return { row: updated, removed: removedUrls }
  })
  resetPublishableCache()

  if (patch.consentRevoked) {
    log.warn({ videoReviewId: id }, 'video consent revoked')
    await removeFiles(removed, log)
  }
  return toAdmin(row)
}

export async function reorderVideoReviews(ids: string[]) {
  await db.$transaction(async (tx) => {
    const found = await tx.videoReview.count({ where: { id: { in: ids }, deletedAt: null } })
    if (found !== ids.length) throw new ApiError(404, 'NOT_FOUND', 'Отзыв не найден')
    for (const [index, id] of ids.entries()) {
      await tx.videoReview.update({ where: { id }, data: { sortOrder: index } })
    }
  })
}

/** Мягкое удаление: видео и постер стираются с диска, документ согласия остаётся как след. */
export async function deleteVideoReview(id: string, log: FastifyBaseLogger) {
  const current = await findActive(id)
  await db.videoReview.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false, mp4Url: null, webmUrl: null, posterUrl: null },
  })
  resetPublishableCache()
  await removeFiles([current.mp4Url, current.webmUrl, current.posterUrl], log)
}

export async function deleteVideoMedia(id: string, slot: MediaSlot, log: FastifyBaseLogger) {
  const current = await findActive(id)
  if (current.isActive && slot !== 'webm') {
    throw new ApiError(409, 'MEDIA_IN_USE', 'Снимите отзыв с публикации, прежде чем удалять ролик или постер')
  }
  await db.videoReview.update({ where: { id }, data: slotData(slot, null) })
  resetPublishableCache()
  await removeFiles([slotUrl(current, slot)], log)
}

export async function uploadVideoMedia(id: string, slot: MediaSlot, file: MultipartFile, log: FastifyBaseLogger) {
  const current = await findActive(id)
  if (current.consentRevokedAt) {
    throw new ApiError(409, 'CONSENT_REVOKED', 'Согласие отозвано: загрузка материалов запрещена')
  }

  const dir = videoReviewsDir
  const tmpDir = tmpDirOf(dir)
  await mkdir(dir, { recursive: true })
  await mkdir(tmpDir, { recursive: true })

  const raw = join(tmpDir, `${randomUUID()}.upload`)
  let work: string | null = null
  try {
    await receiveFile(file, raw, 0o600)
    const prepared = await prepareMedia(slot, raw, tmpDir)
    work = prepared.path

    const finalName = `${randomUUID()}.${prepared.ext}`
    await rename(prepared.path, join(dir, finalName))
    work = null

    const url = `${PUBLIC_PREFIX}${finalName}`
    // Запись только если слот всё ещё держит тот файл, что видели при входе: параллельная загрузка не перезапишет чужой.
    const { count } = await db.videoReview.updateMany({
      where: { id, deletedAt: null, consentRevokedAt: null, ...slotWhere(slot, slotUrl(current, slot)) },
      data: {
        ...slotData(slot, url),
        isActive: false,
        contentReviewed: false,
        contentReviewedAt: null,
        contentReviewedById: null,
      },
    })
    if (count === 0) {
      await rm(join(dir, finalName), { force: true })
      throw new ApiError(409, 'CONFLICT_RETRY', 'Отзыв изменился во время загрузки, обновите страницу и загрузите файл снова')
    }
    resetPublishableCache()
    await removeFiles([slotUrl(current, slot)], log)

    const updated = await db.videoReview.findUniqueOrThrow({ where: { id }, select: { posterUrl: true, webmUrl: true } })
    return { slot, url, warnings: mediaWarnings(slot, updated) }
  } finally {
    await rm(raw, { force: true })
    if (work) await rm(work, { force: true })
  }
}

/** Документ согласия кладём в приватный каталог (0600). Новый документ сбрасывает подтверждение и отзыв. */
export async function uploadConsentDoc(id: string, file: MultipartFile) {
  await findActive(id)

  const dir = videoConsentsDir
  const tmpDir = tmpDirOf(dir)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  await mkdir(tmpDir, { recursive: true, mode: 0o700 })

  const raw = join(tmpDir, `${randomUUID()}.upload`)
  try {
    await receiveFile(file, raw, 0o600)
    const ext = sniffConsentDoc(await readHead(raw))
    const name = `${randomUUID()}.${ext}`
    await rename(raw, join(dir, name))

    const { count } = await db.videoReview.updateMany({
      where: { id, deletedAt: null },
      data: {
        consentDocPath: name,
        consentConfirmed: false,
        consentConfirmedAt: null,
        consentConfirmedById: null,
        consentRevokedAt: null,
        consentRevokedById: null,
        isActive: false,
      },
    })
    if (count === 0) {
      await rm(join(dir, name), { force: true })
      throw new ApiError(404, 'NOT_FOUND', 'Отзыв не найден')
    }
    resetPublishableCache()
    const row = await db.videoReview.findUniqueOrThrow({ where: { id }, include: ADMIN_INCLUDE })
    return toAdmin(row)
  } finally {
    await rm(raw, { force: true })
  }
}

export async function readConsentDoc(id: string) {
  const row = await db.videoReview.findUnique({ where: { id }, select: { consentDocPath: true } })
  if (!row?.consentDocPath) throw new ApiError(404, 'NOT_FOUND', 'Документ согласия не загружен')

  const name = row.consentDocPath
  const path = join(videoConsentsDir, name)
  try {
    await stat(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Документ не найден на сервере')
    }
    throw error
  }

  const mime = name.endsWith('.pdf') ? 'application/pdf' : name.endsWith('.png') ? 'image/png' : 'image/jpeg'
  return { path, mime, filename: `consent-${id}.${name.slice(name.lastIndexOf('.') + 1)}` }
}

/** Публичная выдача: только готовые и действующие отзывы, без полей согласия. */
export async function listPublicVideoReviews(limit: number) {
  const now = new Date()
  const rows = await db.videoReview.findMany({
    where: { isActive: true, ...readyWhere(now) },
    select: { id: true, authorName: true, caption: true, mp4Url: true, webmUrl: true, posterUrl: true, productId: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  })

  const productIds = rows.flatMap((row) => (row.productId ? [row.productId] : []))
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds }, ...ACTIVE, ...productVisibleFor(null) },
        select: { id: true, slug: true, name: true },
      })
    : []
  const productById = new Map(products.map((product) => [product.id, { slug: product.slug, name: product.name }]))

  return rows.flatMap((row) =>
    row.mp4Url && row.posterUrl
      ? [
          {
            id: row.id,
            authorName: row.authorName,
            caption: row.caption,
            mp4Url: row.mp4Url,
            webmUrl: row.webmUrl,
            posterUrl: row.posterUrl,
            product: row.productId ? (productById.get(row.productId) ?? null) : null,
          },
        ]
      : [],
  )
}
