import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { jsxToMarkdown } from '../lib/jsx-to-markdown'

/**
 * Перенос статей блога из кода клиента в базу. Идемпотентно: статьи с уже
 * существующим слагом не трогаются, так что правки владельца в админке не
 * затираются при повторном прогоне (он есть в шаге деплоя).
 */
const prisma = new PrismaClient()
const BLOG_DIR = join(__dirname, '../../../client/src/content/blog')

type Meta = {
  slug: string; title: string; excerpt: string; categories: string[]; date: string
  readingMinutes: number; status: 'published' | 'draft'; cover?: string; metaTitle: string; metaDescription: string
}

function field(src: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}:\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(src) ?? new RegExp(`\\b${name}:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(src)
  return m ? m[1].replace(/\\'/g, "'") : undefined
}

function parseMeta(src: string): Meta | null {
  const slug = field(src, 'slug'); const title = field(src, 'title')
  if (!slug || !title) return null
  const cats = /categories:\s*\[([^\]]*)\]/.exec(src)?.[1] ?? ''
  const categories = [...cats.matchAll(/'([^']+)'/g)].map((x) => x[1])
  return {
    slug, title,
    excerpt: field(src, 'excerpt') ?? '',
    categories,
    date: field(src, 'date') ?? new Date().toISOString().slice(0, 10),
    readingMinutes: Number(/readingMinutes:\s*(\d+)/.exec(src)?.[1] ?? 0),
    status: (field(src, 'status') as Meta['status']) ?? 'draft',
    cover: field(src, 'cover'),
    metaTitle: field(src, 'metaTitle') ?? '',
    metaDescription: field(src, 'metaDescription') ?? '',
  }
}

async function upsertOnce(meta: Meta, body: string): Promise<'created' | 'skipped' | 'cover'> {
  const exists = await prisma.blogPost.findUnique({ where: { slug: meta.slug }, select: { id: true, cover: true } })
  if (exists) {
    // Тексты не трогаем, чтобы правки владельца в админке не затирались. Но
    // обложку, если её ещё нет, ставим из исходника: иначе добавить картинку
    // к уже импортированной статье можно было бы только руками.
    if (!exists.cover && meta.cover) {
      await prisma.blogPost.update({ where: { id: exists.id }, data: { cover: meta.cover } })
      return 'cover'
    }
    return 'skipped'
  }
  await prisma.blogPost.create({
    data: {
      slug: meta.slug, title: meta.title, subtitle: meta.excerpt || null, body,
      categories: meta.categories, date: new Date(`${meta.date}T00:00:00Z`),
      readingMinutes: meta.readingMinutes, status: meta.status, cover: meta.cover ?? null,
      metaTitle: meta.metaTitle || null, metaDescription: meta.metaDescription || null,
    },
  })
  return 'created'
}

async function main() {
  let created = 0, skipped = 0, covered = 0
  const postsDir = join(BLOG_DIR, 'posts')
  for (const file of readdirSync(postsDir).filter((f) => f.endsWith('.tsx'))) {
    const src = readFileSync(join(postsDir, file), 'utf8')
    const meta = parseMeta(src)
    if (!meta) { console.warn(`skip ${file}: no meta`); continue }
    const bodyStart = src.indexOf('body: () => (')
    const body = bodyStart >= 0 ? jsxToMarkdown(src.slice(bodyStart)) : ''
    const r = await upsertOnce(meta, body)
    if (r === 'created') created++; else if (r === 'cover') covered++; else skipped++
  }
  const drafts = readFileSync(join(BLOG_DIR, 'drafts.ts'), 'utf8')
  for (const block of drafts.split(/\n\s*\{\n/).slice(1)) {
    const meta = parseMeta(block)
    if (!meta) continue
    const r = await upsertOnce({ ...meta, status: 'draft' }, '')
    if (r === 'created') created++; else if (r === 'cover') covered++; else skipped++
  }
  console.log(`blog import: created ${created}, covers set ${covered}, skipped ${skipped}`)
  await prisma.$disconnect()
}

main().catch((err) => { console.error('blog import failed:', err instanceof Error ? err.message : err); process.exit(1) })
