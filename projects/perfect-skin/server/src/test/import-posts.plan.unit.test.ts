import { describe, it, expect } from 'vitest'
import { parseFrontmatter, parsePostFile, planPost, type CurrentPost } from '../lib/import-posts.plan.js'

const wrap = (front: string, body = 'Текст статьи.') => `---\n${front}\n---\n${body}\n`

describe('parseFrontmatter', () => {
  it('снимает BOM, принимает CRLF, кавычки и пустые значения', () => {
    const text = `﻿---\r\ntitle: "Тест: «кавычки»"\r\nexcerpt:\r\nseoTitle: 'Иван''s'\r\n---\r\nТело\r\n`
    const { fields, body } = parseFrontmatter('a.md', text)
    expect(fields.get('title')).toBe('Тест: «кавычки»')
    expect(fields.get('excerpt')).toBeNull()
    expect(fields.get('seoTitle')).toBe("Иван's")
    expect(body).toBe('Тело')
  })

  it('пропускает комментарии', () => {
    const { fields } = parseFrontmatter('a.md', wrap('# комментарий\ntitle: Заголовок'))
    expect(fields.get('title')).toBe('Заголовок')
  })

  it('неизвестный ключ — ошибка с файлом и строкой', () => {
    expect(() => parseFrontmatter('a.md', wrap('title: Ок\nauthor: Иван'))).toThrow('a.md:3: неизвестный ключ «author»')
  })

  it('повторный ключ — ошибка', () => {
    expect(() => parseFrontmatter('a.md', wrap('title: Один\ntitle: Два'))).toThrow('ключ «title» повторяется')
  })

  it('многострочное значение — ошибка', () => {
    expect(() => parseFrontmatter('a.md', wrap('excerpt: первая строка\n  продолжение'))).toThrow('многострочные значения')
  })

  it('без открывающей или закрывающей строки — ошибка', () => {
    expect(() => parseFrontmatter('a.md', 'title: x\n')).toThrow('нет открывающей строки')
    expect(() => parseFrontmatter('a.md', '---\ntitle: x\n')).toThrow('нет закрывающей строки')
  })
})

describe('parsePostFile', () => {
  const base = 'title: Заголовок\n'

  it('slug должен совпадать с именем файла', () => {
    const text = wrap('slug: other\n' + base)
    expect(() => parsePostFile('my-post.md', text)).toThrow('не совпадает с именем файла')
  })

  it('день публикации — московская полночь', () => {
    const file = parsePostFile('my-post.md', wrap('slug: my-post\n' + base + 'publishedAt: 2026-10-23'))
    expect(file.publishedAt?.toISOString()).toBe('2026-10-22T21:00:00.000Z')
  })

  it('ISO со смещением принимается, без смещения — нет', () => {
    const ok = parsePostFile('p.md', wrap('slug: p\n' + base + 'publishedAt: 2026-10-23T10:00:00+03:00'))
    expect(ok.publishedAt?.toISOString()).toBe('2026-10-23T07:00:00.000Z')
    expect(() => parsePostFile('p.md', wrap('slug: p\n' + base + 'publishedAt: 2026-10-23T10:00:00'))).toThrow('ISO-дата со смещением')
  })

  it('пустой publishedAt — черновик (null), отсутствующий — не трогаем (undefined)', () => {
    const draft = parsePostFile('p.md', wrap('slug: p\n' + base + 'publishedAt:'))
    expect(draft.publishedAt).toBeNull()
    const absent = parsePostFile('p.md', wrap('slug: p\n' + base))
    expect(absent.publishedAt).toBeUndefined()
  })

  it('превышение длины заголовка — ошибка', () => {
    const long = 'я'.repeat(201)
    expect(() => parsePostFile('p.md', wrap(`slug: p\ntitle: ${long}`))).toThrow('title')
  })

  it('пустое тело — ошибка; локальный путь обложки принимается, с пробелом — нет', () => {
    expect(() => parsePostFile('p.md', `---\nslug: p\n${base}---\n`)).toThrow('body')
    expect(parsePostFile('p.md', wrap('slug: p\n' + base + 'coverImage: /photos/blog/x.webp')).coverImage).toBe('/photos/blog/x.webp')
    expect(() => parsePostFile('p.md', wrap('slug: p\n' + base + 'coverImage: /photos/blog/x y.webp'))).toThrow('coverImage')
  })

  it('isAd разбирается в boolean', () => {
    expect(parsePostFile('p.md', wrap('slug: p\n' + base + 'isAd: true')).isAd).toBe(true)
  })
})

describe('planPost', () => {
  const file = (overrides: Record<string, unknown> = {}) =>
    parsePostFile('p.md', wrap('slug: p\ntitle: Заголовок\nexcerpt: Коротко\n' + Object.entries(overrides).map(([k, v]) => `${k}: ${v}`).join('\n')))

  const current: CurrentPost = {
    id: 'id-1',
    title: 'Заголовок',
    body: 'Текст статьи.',
    excerpt: 'Коротко',
    kind: 'article',
    coverImage: null,
    seoTitle: null,
    seoDescription: null,
    publishedAt: null,
    isAd: false,
    advertiser: null,
    erid: null,
  }

  it('нет в базе — создать с дефолтами', () => {
    const plan = planPost(null, file())
    expect(plan.action).toBe('create')
    if (plan.action !== 'create') return
    expect(plan.data).toMatchObject({ slug: 'p', kind: 'article', isAd: false, publishedAt: null })
  })

  it('совпадает — без изменений', () => {
    expect(planPost(current, file())).toEqual({ action: 'same' })
  })

  it('меняется только то, что в файле и отличается; отсутствующие поля не трогаем', () => {
    const plan = planPost(current, file({ seoTitle: 'Новый SEO' }))
    expect(plan).toEqual({ action: 'update', changed: ['seoTitle'], data: { seoTitle: 'Новый SEO' } })
  })
})
