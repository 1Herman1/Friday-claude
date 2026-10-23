import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { db } from '../lib/db.js'

// Скрипт импорта статей целиком, против тестовой базы: сухой прогон ничего не
// пишет, --apply пишет атомарно, повтор идемпотентен, отключённый пост не трогается.

const PREFIX = `ps-importtest-${Date.now()}`
const SERVER_DIR = new URL('../..', import.meta.url).pathname

let dir = ''

function runImport(...args: string[]) {
  const res = spawnSync(process.execPath, ['--import', 'tsx', 'prisma/import-posts.ts', `--dir=${dir}`, ...args], {
    cwd: SERVER_DIR,
    env: process.env,
    encoding: 'utf-8',
    timeout: 60_000,
  })
  return { code: res.status, out: `${res.stdout}${res.stderr}` }
}

async function writePost(slug: string, fields: Record<string, string>, body = 'Текст статьи') {
  const lines = Object.entries({ slug, ...fields }).map(([key, value]) => `${key}: ${value}`)
  await writeFile(join(dir, `${slug}.md`), `---\n${lines.join('\n')}\n---\n${body}\n`)
}

async function clearDir() {
  await rm(dir, { recursive: true, force: true })
  dir = await mkdtemp(join(tmpdir(), 'ps-import-posts-'))
}

describe('import-posts script', () => {
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ps-import-posts-'))
  })

  afterAll(async () => {
    await db.post.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await rm(dir, { recursive: true, force: true })
  })

  it('сухой прогон показывает план и ничего не пишет', async () => {
    await writePost(`${PREFIX}-news`, { title: '"Открытие шоурума"', kind: 'news', publishedAt: '2026-10-20' })
    await writeFile(join(dir, '_draft.md'), 'не frontmatter вовсе')

    const { code, out } = runImport()
    expect(code).toBe(0)
    expect(out).toContain('Сухой прогон')
    expect(out).toContain('К созданию: 1')
    expect(await db.post.count({ where: { slug: { startsWith: PREFIX } } })).toBe(0)
  })

  it('--apply создаёт публичный активный пост с полями из файла', async () => {
    const { code, out } = runImport('--apply')
    expect(code).toBe(0)
    expect(out).toContain('Записано: создано 1')

    const post = await db.post.findFirstOrThrow({ where: { slug: `${PREFIX}-news`, deletedAt: null } })
    expect(post).toMatchObject({ title: 'Открытие шоурума', kind: 'news', audience: 'public', isActive: true, isAd: false })
    expect(post.publishedAt?.toISOString()).toBe('2026-10-19T21:00:00.000Z')
  })

  it('повторный --apply без правок — без изменений, дубля нет', async () => {
    const { code, out } = runImport('--apply')
    expect(code).toBe(0)
    expect(out).toContain('без изменений')
    expect(await db.post.count({ where: { slug: `${PREFIX}-news`, deletedAt: null } })).toBe(1)
  })

  it('правка файла обновляет только изменённое; поле, которого нет в файле, не трогается', async () => {
    await db.post.updateMany({ where: { slug: `${PREFIX}-news` }, data: { excerpt: 'Задано в админке' } })
    await writePost(`${PREFIX}-news`, { title: '"Шоурум открыт"', kind: 'news', publishedAt: '2026-10-20' })

    const dry = runImport()
    expect(dry.out).toContain('обновить: title')
    expect((await db.post.findFirstOrThrow({ where: { slug: `${PREFIX}-news` } })).title).toBe('Открытие шоурума')

    expect(runImport('--apply').code).toBe(0)
    const post = await db.post.findFirstOrThrow({ where: { slug: `${PREFIX}-news` } })
    expect(post.title).toBe('Шоурум открыт')
    expect(post.excerpt).toBe('Задано в админке')
  })

  it('отключённый в админке пост не включается обратно и не правится', async () => {
    await db.post.updateMany({ where: { slug: `${PREFIX}-news` }, data: { isActive: false } })
    await writePost(`${PREFIX}-news`, { title: '"Попытка вернуть"', kind: 'news' })

    const { code, out } = runImport('--apply')
    expect(code).toBe(0)
    expect(out).toContain('isActive=false')
    const post = await db.post.findFirstOrThrow({ where: { slug: `${PREFIX}-news` } })
    expect(post).toMatchObject({ isActive: false, title: 'Шоурум открыт' })
  })

  it('битый файл в каталоге — код 1 и ни одна статья не записана', async () => {
    await clearDir()
    await writePost(`${PREFIX}-ok`, { title: 'Нормальная' })
    await writePost(`${PREFIX}-bad`, { title: 'Битая', unknownKey: 'x' })

    const { code, out } = runImport('--apply')
    expect(code).toBe(1)
    expect(out).toContain(`${PREFIX}-bad.md`)
    expect(await db.post.count({ where: { slug: `${PREFIX}-ok` } })).toBe(0)
  })

  it('slug во frontmatter не совпадает с именем файла — код 1', async () => {
    await clearDir()
    await writeFile(join(dir, `${PREFIX}-name.md`), `---\nslug: ${PREFIX}-other\ntitle: X\n---\nТекст\n`)
    const { code } = runImport('--apply')
    expect(code).toBe(1)
    expect(await db.post.count({ where: { slug: { in: [`${PREFIX}-name`, `${PREFIX}-other`] } } })).toBe(0)
  })
})
