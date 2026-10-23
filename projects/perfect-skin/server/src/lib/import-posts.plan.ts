import { basename } from 'node:path'
import { z } from 'zod'
import type { PostKind } from './db.js'

const FRONT_KEYS = [
  'slug',
  'title',
  'excerpt',
  'kind',
  'coverImage',
  'seoTitle',
  'seoDescription',
  'publishedAt',
  'isAd',
  'advertiser',
  'erid',
] as const
const FRONT_KEY_SET: ReadonlySet<string> = new Set(FRONT_KEYS)

export interface PostFile {
  slug: string
  title: string
  body: string
  excerpt?: string | null
  kind?: PostKind
  coverImage?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  publishedAt?: Date | null
  isAd?: boolean
  advertiser?: string | null
  erid?: string | null
}

export interface CurrentPost {
  id: string
  title: string
  body: string
  excerpt: string | null
  kind: PostKind
  coverImage: string | null
  seoTitle: string | null
  seoDescription: string | null
  publishedAt: Date | null
  isAd: boolean
  advertiser: string | null
  erid: string | null
}

type Tracked = Pick<
  PostFile,
  'title' | 'body' | 'excerpt' | 'kind' | 'coverImage' | 'seoTitle' | 'seoDescription' | 'publishedAt' | 'isAd' | 'advertiser' | 'erid'
>
type TrackedField = keyof Tracked

const TRACKED_FIELDS: TrackedField[] = [
  'title',
  'body',
  'excerpt',
  'kind',
  'coverImage',
  'seoTitle',
  'seoDescription',
  'publishedAt',
  'isAd',
  'advertiser',
  'erid',
]

export type PostCreateData = Required<Pick<PostFile, 'slug' | 'title' | 'body' | 'kind' | 'isAd'>> &
  Pick<PostFile, 'excerpt' | 'coverImage' | 'seoTitle' | 'seoDescription' | 'publishedAt' | 'advertiser' | 'erid'>

export type PostPlan =
  | { action: 'create'; data: PostCreateData }
  | { action: 'update'; changed: TrackedField[]; data: Partial<Tracked> }
  | { action: 'same' }

const COVER_IMAGE = /^(https:\/\/|\/)[A-Za-z0-9._~\/%-]{1,300}$/
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const HAS_OFFSET = /(Z|[+-]\d{2}:\d{2})$/

export function parseFrontmatter(file: string, text: string): { fields: Map<string, string | null>; body: string } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  if (lines[0]?.trim() !== '---') throw new Error(`${file}: нет открывающей строки «---»`)
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
  if (end === -1) throw new Error(`${file}: нет закрывающей строки «---»`)

  const fields = new Map<string, string | null>()
  for (let index = 1; index < end; index++) {
    const line = lines[index].trim()
    const lineNo = index + 1
    if (line === '' || line.startsWith('#')) continue

    const match = line.match(/^([A-Za-z]+):\s*(.*)$/)
    if (!match) {
      throw new Error(`${file}:${lineNo}: строка не похожа на «ключ: значение» (многострочные значения не поддерживаются)`)
    }
    const [, key, raw] = match
    if (!FRONT_KEY_SET.has(key)) throw new Error(`${file}:${lineNo}: неизвестный ключ «${key}»`)
    if (fields.has(key)) throw new Error(`${file}:${lineNo}: ключ «${key}» повторяется`)
    fields.set(key, parseValue(file, lineNo, raw))
  }

  const body = lines.slice(end + 1).join('\n').trim()
  return { fields, body }
}

function parseValue(file: string, lineNo: number, raw: string): string | null {
  if (raw === '') return null
  if (raw.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed === 'string') return parsed
    } catch {
      // ниже — общая ошибка
    }
    throw new Error(`${file}:${lineNo}: некорректная строка в двойных кавычках`)
  }
  if (raw.startsWith("'")) {
    if (raw.length < 2 || !raw.endsWith("'")) throw new Error(`${file}:${lineNo}: незакрытая одинарная кавычка`)
    return raw.slice(1, -1).replace(/''/g, "'")
  }
  return raw
}

const optionalText = (max: number) => z.string().max(max).nullable().optional()

const PostFrontSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,100}$/),
  title: z.string().min(1).max(200),
  excerpt: optionalText(500),
  kind: z.enum(['article', 'news']).optional(),
  coverImage: z.string().regex(COVER_IMAGE).nullable().optional(),
  seoTitle: optionalText(60),
  seoDescription: optionalText(160),
  publishedAt: z.string().nullable().optional(),
  isAd: z.enum(['true', 'false']).optional(),
  advertiser: optionalText(200),
  erid: optionalText(100),
  body: z.string().min(1).max(100_000),
})

function parsePublishedAt(file: string, value: string): Date {
  let date: Date
  if (DATE_ONLY.test(value)) {
    date = new Date(`${value}T00:00:00+03:00`)
  } else if (HAS_OFFSET.test(value)) {
    date = new Date(value)
  } else {
    throw new Error(`${file}: publishedAt должен быть YYYY-MM-DD или ISO-дата со смещением`)
  }
  if (Number.isNaN(date.getTime())) throw new Error(`${file}: publishedAt — некорректная дата`)
  return date
}

/** Разбор файла статьи. Пустое значение (ключ есть, значения нет) = null; отсутствующий ключ = undefined. */
export function parsePostFile(file: string, text: string): PostFile {
  const { fields, body } = parseFrontmatter(file, text)
  const parsed = PostFrontSchema.safeParse({ ...Object.fromEntries(fields), body })
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.') || '(корень)'}: ${issue.message}`)
    throw new Error(`${file}: ${issues.join('; ')}`)
  }

  const front = parsed.data
  const expectedSlug = basename(file, '.md')
  if (front.slug !== expectedSlug) throw new Error(`${file}: slug «${front.slug}» не совпадает с именем файла`)

  return {
    slug: front.slug,
    title: front.title,
    body: front.body,
    excerpt: front.excerpt,
    kind: front.kind,
    coverImage: front.coverImage,
    seoTitle: front.seoTitle,
    seoDescription: front.seoDescription,
    publishedAt: front.publishedAt === undefined ? undefined : front.publishedAt === null ? null : parsePublishedAt(file, front.publishedAt),
    isAd: front.isAd === undefined ? undefined : front.isAd === 'true',
    advertiser: front.advertiser,
    erid: front.erid,
  }
}

function createData(file: PostFile): PostCreateData {
  return {
    slug: file.slug,
    title: file.title,
    body: file.body,
    excerpt: file.excerpt ?? null,
    kind: file.kind ?? 'article',
    coverImage: file.coverImage ?? null,
    seoTitle: file.seoTitle ?? null,
    seoDescription: file.seoDescription ?? null,
    publishedAt: file.publishedAt ?? null,
    isAd: file.isAd ?? false,
    advertiser: file.advertiser ?? null,
    erid: file.erid ?? null,
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  return a === b
}

/** Что делать с файлом: создать, обновить изменившиеся поля или ничего. Отсутствующее в файле поле не трогаем. */
export function planPost(current: CurrentPost | null, file: PostFile): PostPlan {
  if (!current) return { action: 'create', data: createData(file) }

  const changed: TrackedField[] = []
  const data: Partial<Tracked> = {}
  for (const field of TRACKED_FIELDS) {
    const next = file[field]
    if (next === undefined) continue
    if (sameValue(next, current[field])) continue
    changed.push(field)
    Object.assign(data, { [field]: next })
  }

  if (changed.length === 0) return { action: 'same' }
  return { action: 'update', changed, data }
}
