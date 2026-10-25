import { PrismaClient } from '../../../../node_modules/.prisma/ps-client/index.js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { parsePostFile, planPost, type CurrentPost, type PostFile, type PostPlan } from '../src/lib/import-posts.plan.js'
import { extractProductSlugs } from '../src/lib/post-body.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_DIR = path.join(__dirname, '../assets/posts')
const CLIENT_PUBLIC = path.join(__dirname, '../../client/public')

interface LoadedPost {
  name: string
  file: PostFile
}

function argValue(name: string): string | undefined {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
}

function loadPosts(dir: string): LoadedPost[] {
  const names = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.md') && !name.startsWith('_'))
    .sort()
  const posts = names.map((name) => ({
    name,
    file: parsePostFile(name, fs.readFileSync(path.join(dir, name), 'utf-8')),
  }))

  const seen = new Set<string>()
  for (const { name, file } of posts) {
    if (seen.has(file.slug)) throw new Error(`${name}: повтор slug «${file.slug}» в каталоге статей`)
    seen.add(file.slug)
  }
  return posts
}

function describePlan(plan: PostPlan): string {
  if (plan.action === 'create') return 'создать'
  if (plan.action === 'same') return 'без изменений'
  return `обновить: ${plan.changed.join(', ')}`
}

async function runDb(prisma: PrismaClient, posts: LoadedPost[], apply: boolean): Promise<void> {
  const warnings: string[] = []
  const slugs = posts.map((post) => post.file.slug)

  const rows = await prisma.post.findMany({
    where: { slug: { in: slugs }, deletedAt: null },
    select: {
      id: true,
      slug: true,
      title: true,
      body: true,
      excerpt: true,
      kind: true,
      coverImage: true,
      seoTitle: true,
      seoDescription: true,
      publishedAt: true,
      isAd: true,
      advertiser: true,
      erid: true,
      isActive: true,
    },
  })
  const bySlug = new Map(rows.map((row) => [row.slug, row]))

  const productSlugs = [...new Set(posts.flatMap((post) => extractProductSlugs(post.file.body)))]
  const activeProducts = productSlugs.length
    ? new Set(
        (
          await prisma.product.findMany({
            where: { slug: { in: productSlugs }, isActive: true, deletedAt: null },
            select: { slug: true },
          })
        ).map((product) => product.slug),
      )
    : new Set<string>()

  const plans: Array<{ name: string; id?: string; plan: PostPlan }> = []
  for (const { name, file } of posts) {
    if (file.coverImage?.startsWith('/') && !fs.existsSync(path.join(CLIENT_PUBLIC, file.coverImage))) {
      warnings.push(`${name}: нет файла обложки ${file.coverImage} в client/public`)
    }
    for (const slug of extractProductSlugs(file.body)) {
      if (!activeProducts.has(slug)) warnings.push(`${name}: товар [[product:${slug}]] не найден среди активных`)
    }
    for (const [, src] of file.body.matchAll(/^!\[[^\]]+\]\((\/photos\/blog\/[a-z0-9-]+\.webp)\)$/gm)) {
      if (!fs.existsSync(path.join(CLIENT_PUBLIC, src))) warnings.push(`${name}: нет иллюстрации ${src} в client/public`)
    }

    const row = bySlug.get(file.slug)
    if (row && !row.isActive) {
      warnings.push(`${name}: пост в базе отключён (isActive=false), не трогаем`)
      continue
    }
    const current: CurrentPost | null = row ?? null
    plans.push({ name, id: row?.id, plan: planPost(current, file) })
  }

  for (const { name, plan } of plans) console.log(`• ${name}: ${describePlan(plan)}`)

  const creates = plans.filter((item) => item.plan.action === 'create').length
  const updates = plans.filter((item) => item.plan.action === 'update').length
  console.log('\nИтог:')
  console.log(`  Файлов статей: ${posts.length}`)
  console.log(`  К созданию: ${creates}, к обновлению: ${updates}, без изменений: ${plans.length - creates - updates}`)
  if (warnings.length) {
    console.log('  Предупреждения:')
    for (const warning of warnings) console.log(`    - ${warning}`)
  }

  if (!apply) {
    console.log('\nСухой прогон: ничего не записано. Для записи — с флагом --apply.')
    return
  }

  await prisma.$transaction(
    async (tx) => {
      for (const { id, plan } of plans) {
        if (plan.action === 'create') {
          await tx.post.create({ data: { ...plan.data, audience: 'public', isActive: true } })
        } else if (plan.action === 'update' && id) {
          await tx.post.update({ where: { id }, data: plan.data })
        }
      }
    },
    { timeout: 60_000 },
  )
  console.log(`\nЗаписано: создано ${creates}, обновлено ${updates}`)
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const dir = path.resolve(argValue('dir') ?? DEFAULT_DIR)
  const posts = loadPosts(dir)
  console.log(`Статьи: ${posts.length} файлов из ${dir}`)
  console.log(`Режим: ${apply ? 'ЗАПИСЬ В БАЗУ' : 'сухой прогон'}`)

  const prisma = new PrismaClient()
  try {
    await runDb(prisma, posts, apply)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Ошибка:', error instanceof Error ? error.message : error)
  process.exit(1)
})
