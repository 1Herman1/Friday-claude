import { describe, it, expect } from 'vitest'
import { parseDocx, parseVolume, productKey, type ParsedRecord } from '../lib/product-docx.parse.js'
import { makeDocx } from './product-docx.fixture.js'

const parse = (lines: string[]): ParsedRecord[] =>
  parseDocx(makeDocx(lines), { file: 'test.docx', sha1: 'sha', brand: 'ISSEIMI' }).records

const LONG = 'Текст. '.repeat(40)

const card = (header: string, volume: string, ...rest: string[]): string[] => [
  header,
  volume,
  'Короткое описание.',
  'Как работает формула:',
  '* Пункт: описание механизма.',
  ...rest,
]

describe('границы товаров', () => {
  it('делит товары по заголовку и строке объёма, без разделителя «…»', () => {
    const records = parse([
      'EGF HIDROSOLUBLE – Сыворотка',
      'Объем: 50 мл',
      LONG,
      'Как работает формула:',
      '* Первый пункт.',
      'SECOND PRODUCT – Крем',
      'Объем: 30 мл',
      'Описание.',
      'Как работает формула:',
      '* Пункт.',
    ])
    expect(records.map((r) => r.name)).toEqual(['EGF HIDROSOLUBLE', 'SECOND PRODUCT'])
    expect(records.map((r) => r.volume?.each)).toEqual([50, 30])
    expect(records.every((r) => r.details !== null)).toBe(true)
  })

  it('убирает мусор Word «Конец формы» из строки заголовка', () => {
    const [record] = parse(['Конец формы TTS ENERGIZING MASK – Маска со стволовыми клетками', 'Монодоза: 1 маска.', 'Описание.', 'Как работает формула:', '* Пункт.'])
    expect(record.name).toBe('TTS ENERGIZING MASK')
    expect(record.key).toBe('ttsenergizingmask')
    expect(record.volume).toBeNull()
  })

  it('кириллическая В в начале слова не ломает латинский ключ', () => {
    const [record] = parse(card('ВEEVENOM SERUM Антивозрастная сыворотка', 'Объем: 30 мл'))
    expect(record.key).toBe('beevenomserum')
  })

  it('подзаголовок между именем и объёмом входит в название', () => {
    const [record] = parse(['FLUVIX ', 'СЫВОРОТКА ОБНОВЛЯЮЩАЯ ', 'Объем 30 мл.', 'Описание.', 'Как работает формула:', '* Пункт.'])
    expect(record.title).toBe('FLUVIX СЫВОРОТКА ОБНОВЛЯЮЩАЯ')
    expect(record.volumeLine).toBe('Объем 30 мл.')
  })

  it('товар без строки объёма (K & B) берётся по заголовку, объём — из прайса', () => {
    const [record] = parse(['K & B BUTTER CREAM', 'Крем с баобабом и карите', 'Описание.', 'Как работает формула:', '* Пункт.'])
    expect(record.key).toBe('kbbuttercream')
    expect(record.volume).toBeNull()
    expect(record.warnings).toContain('в файле нет строки объёма: объём берётся из прайса')
  })

  it('зона «ПРЕПАРАТЫ ДЛЯ ПРОФЕССИОНАЛЬНОГО ПРИМЕНЕНИЯ» закрывает предыдущий товар, строка «Подобные маски…» пропускается', () => {
    const parsed = parseDocx(
      makeDocx([
        ...card('FIRST – Крем', 'Объем: 50 мл', 'Способ применения:', 'Наносить утром.'),
        'Подобные маски уже были в Части 2',
        'ПРЕПАРАТЫ ДЛЯ ПРОФЕССИОНАЛЬНОГО ПРИМЕНЕНИЯ',
        'Текст без заголовка.',
      ]),
      { file: 'test.docx', sha1: 'sha', brand: 'ISSEIMI' },
    )
    expect(parsed.records).toHaveLength(1)
    expect(parsed.records[0].details?.usage?.steps[0].text).toBe('Наносить утром.')
    expect(parsed.orphans).toEqual(['Текст без заголовка.'])
    expect(parsed.fileRules.join(' ')).toContain('маркер зоны')
  })
})

describe('заголовки блоков', () => {
  it('распознаёт варианты: латинская C в «Cпособ», «Ключевые механизмы», «Кому подойдет», лайв-хак', () => {
    const [record] = parse([
      'PRODUCT – Крем',
      'Объем: 50 мл',
      'Короткое описание.',
      'Ключевые механизмы действия:',
      '* Механизм один: текст.',
      'КОМУ ПОДОЙДЕТ:',
      '* Всем типам кожи.',
      'Ключевые активные компоненты:',
      'Аллантоин',
      'Cпособ применения:',
      'Наносить утром.',
      '◀ Лайв-хак: Совет эксперта.',
    ])
    const details = record.details!
    expect(details.howItWorks?.heading).toBe('Ключевые механизмы действия')
    expect(details.forWhom?.items).toEqual(['Всем типам кожи.'])
    expect(details.actives).toEqual(['Аллантоин'])
    expect(details.usage?.heading).toBe('Способ применения')
    expect(details.lifehack).toEqual({ title: 'Лайв-хак', paragraphs: ['Совет эксперта.'] })
  })

  it('заголовок с текстом в той же строке и заголовок на отдельной строке дают один список', () => {
    const [record] = parse(card('P – Крем', 'Объем: 50 мл', 'АКТИВНЫЕ ИНГРЕДИЕНТЫ: EGF', 'Активные ингредиенты:', 'Аллантоин'))
    expect(record.details?.actives).toEqual(['EGF', 'Аллантоин'])
  })

  it('строка «Активные компоненты NMF…» без двоеточия не становится заголовком', () => {
    const [record] = parse(['P – Тоник', 'Объем: 200 мл', LONG, 'Активные компоненты NMF (ионы натрия) поддерживают влажность.', 'Как работает формула:', '* Пункт.'])
    expect(record.details?.actives).toEqual([])
    expect(record.details?.intro).toEqual([LONG.trim(), 'Активные компоненты NMF (ионы натрия) поддерживают влажность.'])
  })

  it('«Состав (INCI)» пропускается и не попадает в ингредиенты', () => {
    const [record] = parse(card('P – Крем', 'Объем: 50 мл', 'Состав (INCI):…', 'Активные ингредиенты:', 'EGF'))
    expect(record.details?.actives).toEqual(['EGF'])
  })

  it('строки «Как работает» без пунктов уходят в lead, пункты — в items', () => {
    const [record] = parse(['P – Крем', 'Объем: 50 мл', 'Описание.', 'Как работает формула:', 'Вступительная фраза.', '* Пункт: текст.'])
    expect(record.details?.howItWorks?.lead).toEqual(['Вступительная фраза.'])
    expect(record.details?.howItWorks?.items).toEqual([{ title: 'Пункт', text: 'текст.' }])
  })
})

describe('деление пунктов и подписи', () => {
  it('«Заголовок: текст» делится по первому двоеточию', () => {
    const [record] = parse(card('P – Крем', 'Объем: 50 мл', '* Пептидный комплекс: уплотняет кожу.', '* Без заголовка.'))
    expect(record.details?.howItWorks?.items).toEqual([
      { title: 'Пункт', text: 'описание механизма.' },
      { title: 'Пептидный комплекс', text: 'уплотняет кожу.' },
      { title: null, text: 'Без заголовка.' },
    ])
  })

  it('длинная часть до двоеточия (больше 90 знаков) и часть с точкой не делятся', () => {
    const longHead = 'я'.repeat(95)
    const [record] = parse(card('P – Крем', 'Объем: 50 мл', `* ${longHead}: текст.`, '* т.е. пример: текст.'))
    const items = record.details?.howItWorks?.items ?? []
    expect(items[1]).toEqual({ title: null, text: `${longHead}: текст.` })
    expect(items[2]).toEqual({ title: null, text: 'т.е. пример: текст.' })
  })

  it('строка-продолжение (со строчной буквы) склеивается с предыдущим пунктом', () => {
    const [record] = parse(['P – Крем', 'Объем: 50 мл', 'Описание.', 'Как работает формула:', '* Модуляция: заживление тканей', 'без риска рубцов.'])
    expect(record.details?.howItWorks?.items).toEqual([{ title: 'Модуляция', text: 'заживление тканей без риска рубцов.' }])
  })

  it('«Утром:» и «Вечером:» в «Как работает» становятся заголовками пунктов', () => {
    const [record] = parse(['P – Крем', 'Объем: 50 мл', 'Описание.', 'Как работает формула:', '* Пункт: текст.', 'Утром: Работает как база.', 'Вечером: Запускает регенерацию.'])
    expect(record.details?.howItWorks?.items.slice(1)).toEqual([
      { title: 'Утром', text: 'Работает как база.' },
      { title: 'Вечером', text: 'Запускает регенерацию.' },
    ])
  })

  it('вступление: короткие абзацы до первого длинного — tagline, остальные — intro', () => {
    const [record] = parse(['P – Крем', 'Объем: 50 мл', 'Короткая строка один.', 'Короткая строка два.', LONG, 'Короткая в конце.', 'Как работает формула:', '* Пункт.'])
    expect(record.details?.tagline).toEqual(['Короткая строка один.', 'Короткая строка два.'])
    expect(record.details?.intro).toEqual([LONG.trim(), 'Короткая в конце.'])
  })

  it('в «Кому подойдёт» строки до маркеров — lead, после маркеров — note', () => {
    const [record] = parse(['P – Крем', 'Объем: 50 мл', 'Описание.', 'КОМУ ПОДОЙДЕТ:', 'Для всех:', '* Первый.', 'Итог: примечание.'])
    expect(record.details?.forWhom).toEqual({ lead: 'Для всех:', items: ['Первый.'], note: ['Итог: примечание.'] })
  })
})

describe('секции способа применения и лайфхака', () => {
  it('«Утром:» становится заголовком шага, подпись перед пунктом с заголовком — примечанием', () => {
    const [record] = parse([
      'P – Крем',
      'Объем: 50 мл',
      'Описание.',
      'Как работает формула:',
      '* Пункт: текст.',
      'Способ применения:',
      'Выберите протокол:',
      'Для сухой кожи: один раз в неделю.',
      'Утром:',
      'Нанесите утром.',
    ])
    expect(record.details?.usage?.notes).toEqual(['Выберите протокол'])
    expect(record.details?.usage?.steps).toEqual([
      { title: 'Для сухой кожи', text: 'один раз в неделю.' },
      { title: 'Утром', text: 'Нанесите утром.' },
    ])
  })

  it('«💡 Лайф-хак: текст» — title до двоеточия, абзац после', () => {
    const [record] = parse(card('P – Крем', 'Объем: 50 мл', '💡 Лайф-хак: Используйте тоник.'))
    expect(record.details?.lifehack).toEqual({ title: 'Лайф-хак', paragraphs: ['Используйте тоник.'] })
  })

  it('«Лайфхак от экспертов:» без текста в строке — абзацы идут следующими строками', () => {
    const [record] = parse(card('P – Крем', 'Объем: 50 мл', '💡 Лайфхак от экспертов:', 'Первый абзац.', 'Второй абзац.'))
    expect(record.details?.lifehack).toEqual({ title: 'Лайфхак от экспертов', paragraphs: ['Первый абзац.', 'Второй абзац.'] })
  })

  it('заголовок лайфхака без двоеточия: title = null, вся строка — абзац', () => {
    const [record] = parse(card('P – Крем', 'Объем: 50 мл', '💡 Лайф-хак Протокол максимального уплотнения'))
    expect(record.details?.lifehack).toEqual({ title: null, paragraphs: ['Лайф-хак Протокол максимального уплотнения'] })
  })

  it('лайфхак без текста: блок не выводится, есть предупреждение', () => {
    const [record] = parse(card('P – Крем', 'Объем: 50 мл', '◀ Лайв-хак:'))
    expect(record.details?.lifehack).toBeNull()
    expect(record.warnings).toContain('лайфхак без текста: заголовок есть, абзацев нет')
  })

  it('повтор секции «Кому подойдёт» сливается без дублей, с предупреждением', () => {
    const [record] = parse(['P – Крем', 'Объем: 50 мл', 'Описание.', 'КОМУ ПОДОЙДЕТ:', '* Первый.', '* Второй.', 'КОМУ ПОДОЙДЕТ:', '* Второй.', '* Третий.'])
    expect(record.details?.forWhom?.items).toEqual(['Первый.', 'Второй.', 'Третий.'])
    expect(record.warnings.join(' ')).toContain('повтор секции «КОМУ ПОДОЙДЕТ»')
  })
})

describe('дополнения и вклейки', () => {
  it('«В этот препарат …» — дополнение, текст уходит в notes, а не в отдельный товар', () => {
    const records = parse([
      ...card('KERATHOR PLUS – ИЗОТОНИЧЕСКИЙ ТОНИК', 'Объем: 200 мл', 'Способ применения:', 'Наносить.'),
      '…………',
      'В этот препарат KERATHOR PLUS – ИЗОТОНИЧЕСКИЙ ТОНИК',
      'Объем: 200 мл в СПОСОБ ПРИМЕНЕНИЯ добавить:',
      'В профессиональных уходах применяется.',
    ])
    expect(records).toHaveLength(2)
    expect(records[1].kind).toBe('amendment')
    expect(records[1].key).toBe('kerathorplus')
    expect(records[1].amendmentNotes).toEqual(['В профессиональных уходах применяется.'])
    expect(records[1].volume).toEqual({ count: 1, each: 200, unit: 'мл' })
  })

  it('FLUVIX 15 мл: текст вклейки 30 мл отрезается, своё применение сохраняется', () => {
    const [record] = parse([
      'FLUVIX ',
      'СЫВОРОТКА ОБНОВЛЯЮЩАЯ ',
      'Объем 15 мл.',
      'Описание.',
      'Как работает формула:',
      '* Пункт 15.',
      'Способ применения:',
      'Наносите 15.',
      'Инновационный космецевтический препарат для индукции репарации.',
      '* Пункт 30 из вклейки.',
    ])
    expect(record.key).toBe('fluvix')
    expect(record.details?.howItWorks?.items.map((i) => i.text)).toEqual(['Пункт 15.'])
    expect(record.details?.usage?.steps.map((s) => s.text)).toEqual(['Наносите 15.'])
    expect(JSON.stringify(record.details)).not.toContain('вклейки')
    expect(record.rules.join(' ')).toContain('обрезана вклейка 30 мл')
  })
})

describe('объём', () => {
  it('разбирает варианты написания объёма', () => {
    expect(parseVolume('Объем: Флакон с пипеткой, 30 мл')).toEqual({ count: 1, each: 30, unit: 'мл' })
    expect(parseVolume('Объем 15 мл.')).toEqual({ count: 1, each: 15, unit: 'мл' })
    expect(parseVolume('5 флаконов по 5 мл')).toEqual({ count: 5, each: 5, unit: 'мл' })
    expect(parseVolume('5 × 5 мл')).toEqual({ count: 5, each: 5, unit: 'мл' })
    expect(parseVolume('Монодоза: 1 маска, пропитанная')).toBeNull()
    expect(parseVolume('28х35 см /13х17 см')).toBeNull()
  })

  it('ключ товара: двойники, диакритика, скобки и знаки не мешают сравнению', () => {
    expect(productKey('AQUAO3 (GF) ANTIAGING')).toBe('aquao3antiaging')
    expect(productKey('AQUA O3 ANTIAGING')).toBe('aquao3antiaging')
    expect(productKey('ÁCIDO GLICOLICO')).toBe('acidoglicolico')
    expect(productKey('K & B BUTTER CREAM')).toBe('kbbuttercream')
    expect(productKey('ВEEVENOM SERUM')).toBe('beevenomserum')
  })
})
