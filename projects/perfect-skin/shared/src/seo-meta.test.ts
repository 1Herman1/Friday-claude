import { describe, it, expect } from 'vitest'
import {
  formatRub,
  isServicePath,
  metaForBlogList,
  metaForCategory,
  metaForHome,
  metaForNotFound,
  metaForPost,
  metaForProduct,
  metaForStatic,
  plainText,
  postPath,
  truncate,
} from './seo-meta'

describe('formatRub', () => {
  it('переводит копейки в рубли с пробелом между разрядами', () => {
    expect(formatRub(600000)).toBe('6 000 ₽')
    expect(formatRub(299000)).toBe('2 990 ₽')
    expect(formatRub(123456700)).toBe('1 234 567 ₽')
  })
})

describe('metaForHome', () => {
  it('H1 и title из аудита, canonical на корень', () => {
    const meta = metaForHome()
    expect(meta.h1).toBe('Профессиональная косметика для лица из Испании')
    expect(meta.title).toBe('Магазин профессиональной косметики для лица в Москве — Perfect Skin')
    expect(meta.description).toContain('бесплатно от 6 000 ₽')
    expect(meta.canonicalPath).toBe('/')
    expect(meta.noindex).toBeUndefined()
  })
})

describe('metaForCategory', () => {
  it('H1 добавляет «для лица», если в названии нет «для»', () => {
    const meta = metaForCategory({ name: 'Сыворотки', slug: 'syvorotki' }, 12, 299000)
    expect(meta.h1).toBe('Сыворотки для лица')
    expect(meta.title).toBe('Сыворотки для лица — купить профессиональные в Москве')
    expect(meta.description).toBe('12 средств ISSEIMI и GLACÉE, от 2 990 ₽. Доставка по России')
    expect(meta.canonicalPath).toBe('/catalog/syvorotki')
  })

  it('не дублирует «для» в названии вроде «Кремы для век»', () => {
    const meta = metaForCategory({ name: 'Кремы для век', slug: 'kremy-dlya-vek' }, 1, null)
    expect(meta.h1).toBe('Кремы для век')
    expect(meta.description).toBe('1 средство ISSEIMI и GLACÉE. Доставка по России')
  })

  it('без товаров и цены не выдумывает счётчик и цену', () => {
    const meta = metaForCategory({ name: 'Маски', slug: 'maski' }, 0, null)
    expect(meta.description).toBe('Доставка по России')
  })

  it('берёт seo-поля категории из базы, если они заданы', () => {
    const meta = metaForCategory(
      { name: 'Маски', slug: 'maski', seoTitle: 'Маски ISSEIMI', seoDescription: 'Описание из админки' },
      3,
      null,
    )
    expect(meta.title).toBe('Маски ISSEIMI')
    expect(meta.description).toBe('Описание из админки')
  })
})

describe('metaForProduct', () => {
  it('title, description и H1 с брендом и ценой', () => {
    const meta = metaForProduct({ name: 'RETI+ крем', slug: 'reti-plus', brandName: 'ISSEIMI' }, 245000)
    expect(meta.h1).toBe('RETI+ крем')
    expect(meta.title).toBe('RETI+ крем ISSEIMI: купить в Москве — Perfect Skin')
    expect(meta.description).toBe('Купить RETI+ крем ISSEIMI от 2 450 ₽. Доставка СДЭК, самовывоз в Москве')
    expect(meta.canonicalPath).toBe('/product/reti-plus')
  })

  it('без цены и бренда — только название', () => {
    const meta = metaForProduct({ name: 'Тоник', slug: 'tonik' }, null)
    expect(meta.description).toBe('Купить Тоник. Доставка СДЭК, самовывоз в Москве')
  })

  it('seo-поля товара важнее шаблона', () => {
    const meta = metaForProduct(
      { name: 'Тоник', slug: 'tonik', seoTitle: 'Свой title', seoDescription: 'Свой description' },
      100
    )
    expect(meta.title).toBe('Свой title')
    expect(meta.description).toBe('Свой description')
  })
})

describe('metaForPost', () => {
  it('article и news получают правильный canonical', () => {
    const article = metaForPost({ title: 'Статья', slug: 'a', kind: 'article', body: 'Текст' })
    const news = metaForPost({ title: 'Новость', slug: 'n', kind: 'news', body: 'Текст' })
    expect(article.canonicalPath).toBe('/blog/a')
    expect(news.canonicalPath).toBe('/news/n')
  })

  it('seoTitle и seoDescription важнее заголовка и excerpt', () => {
    const meta = metaForPost({
      title: 'ЯБЛОКО',
      slug: 'a',
      kind: 'article',
      excerpt: 'Анонс',
      body: 'Тело',
      seoTitle: 'Яблоко, которое не стареет',
      seoDescription: 'Описание для поиска',
    })
    expect(meta.title).toBe('Яблоко, которое не стареет')
    expect(meta.description).toBe('Описание для поиска')
    expect(meta.h1).toBe('ЯБЛОКО')
  })

  it('без excerpt описание берётся из текста без разметки', () => {
    const meta = metaForPost({ title: 'T', slug: 't', kind: 'article', body: '## Заголовок\n\n**Жирный** [ссылка](/x) [[product:serum]]' })
    expect(meta.description).toBe('Заголовок Жирный ссылка')
  })
})

describe('metaForBlogList', () => {
  it('статьи и новости', () => {
    expect(metaForBlogList('article')).toMatchObject({ h1: 'Статьи об уходе', canonicalPath: '/blog', title: 'Статьи об уходе — Perfect Skin' })
    expect(metaForBlogList('news')).toMatchObject({ h1: 'Новости', canonicalPath: '/news' })
  })
})

describe('metaForStatic', () => {
  it.each(['/brands', '/pro', '/consultation', '/about', '/contacts', '/catalog', '/offer', '/privacy'])(
    'публичная страница %s задаёт свой title и canonical',
    (path) => {
      const meta = metaForStatic(path)
      expect(meta.title).toBeTruthy()
      expect(meta.h1).toBeTruthy()
      expect(meta.canonicalPath).toBe(path)
      expect(meta.noindex).toBeUndefined()
    },
  )

  it.each(['/admin', '/admin/orders', '/auth', '/checkout', '/orders/123', '/track', '/cart', '/favorites', '/staff-login', '/pro/register', '/account'])(
    'служебный путь %s закрыт от индексации',
    (path) => {
      expect(isServicePath(path)).toBe(true)
      expect(metaForStatic(path).noindex).toBe(true)
    },
  )

  it('контакты содержат телефон и адрес самовывоза', () => {
    const meta = metaForStatic('/contacts')
    expect(meta.description).toContain('+7 (495) 183-28-48')
    expect(meta.description).toContain('Звенигородское шоссе, 3Ас1')
  })

  it('неизвестный путь — 404-мета с noindex и без canonical', () => {
    expect(metaForStatic('/nope')).toEqual(metaForNotFound())
    expect(metaForNotFound()).toMatchObject({ noindex: true, canonicalPath: null, h1: 'Страница не найдена' })
  })
})

describe('postPath', () => {
  it('статьи в /blog, новости в /news', () => {
    expect(postPath('article', 'x')).toBe('/blog/x')
    expect(postPath('news', 'x')).toBe('/news/x')
  })
})

describe('plainText и truncate', () => {
  it('убирает разметку и токены товаров', () => {
    expect(plainText('# Заголовок\n[[product:a]] **важно** `код`')).toBe('Заголовок важно код')
  })

  it('обрезает длинный текст по слову с многоточием', () => {
    const text = 'слово '.repeat(60).trim()
    const result = truncate(text, 100)
    expect(result.endsWith('…')).toBe(true)
    expect(result.length).toBeLessThanOrEqual(100)
    expect(result).not.toMatch(/\s…$/)
  })

  it('короткий текст не трогает', () => {
    expect(truncate('коротко', 100)).toBe('коротко')
  })
})
