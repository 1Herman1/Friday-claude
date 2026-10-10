import { describe, it, expect } from 'vitest'
import { parseDocx, type ParsedRecord, type VolumeSpec } from '../lib/product-docx.parse.js'
import { matchAll, type CabinetVariant, type SiteProduct } from '../lib/product-docx.match.js'
import { makeDocx } from './product-docx.fixture.js'

const vol = (each: number, count = 1): VolumeSpec => ({ count, each, unit: 'мл' })

const site: SiteProduct[] = [
  { slug: 'emulsion', name: 'EMULSION HIGIENIZANTE Крем-скраб', brand: 'ISSEIMI', kind: 'retail', volume: vol(200) },
  { slug: 'veevenom', name: 'ВEEVENOM SERUM Антивозрастная сыворотка', brand: 'ISSEIMI', kind: 'retail', volume: vol(30) },
  { slug: 'aquao3-gf', name: 'AQUAO3 (GF) ANTIAGING Сыворотка с озоном', brand: 'isseimi', kind: 'pro', volume: vol(5, 5) },
  { slug: 'kb', name: 'K&B BUTTER CREAM Крем с маслами', brand: 'isseimi', kind: 'pro', volume: vol(300) },
  {
    slug: 'mascarilla-peel-off-vitamina-c-maska-s-vitaminom-s-alginatnaya',
    name: 'MASCARILLA PEEL OFF VITAMINA C Маска с витамином С',
    brand: 'isseimi',
    kind: 'pro',
    volume: vol(200),
  },
  { slug: 'natural-cleansing', name: 'NATURAL CLEANSING MILK Натуральный крем', brand: 'ISSEIMI', kind: 'retail', volume: vol(200) },
  { slug: 'gen-adn', name: 'GEN ADN Укрепляющий крем', brand: 'GLACÉE Skincare', kind: 'retail', volume: vol(50) },
]

const variants: CabinetVariant[] = [
  { siteName: 'EMULSION HIGIENIZANTE', volume: vol(1000) },
  { siteName: 'NATURAL CLEANSING MILK', volume: vol(500) },
]

const card = (header: string, volume: string, text: string): string[] => [
  header,
  volume,
  `${text} Короткое описание.`,
  'Как работает формула:',
  '* Пункт: описание.',
]

const parse = (lines: string[], file: string, brand: string): ParsedRecord[] =>
  parseDocx(makeDocx(lines), { file, sha1: `sha-${file}`, brand }).records

const run = (records: ParsedRecord[], products: SiteProduct[] = site, cabinet: CabinetVariant[] = variants) =>
  matchAll(records, products, cabinet)

describe('сопоставление по ключу', () => {
  it('кириллическая В в названии сайта совпадает с латинским файлом', () => {
    const report = run(parse(card('BEEVENOM SERUM – Сыворотка', 'Объем: 30 мл', 'Описание.'), 'a.docx', 'ISSEIMI'))
    expect(report.matched.map((m) => m.slug)).toContain('veevenom')
  })

  it('AQUA O3 ANTIAGING из файла совпадает с AQUAO3 (GF) ANTIAGING на сайте', () => {
    const report = run(parse(card('AQUA O3 ANTIAGING – Регенерирующая сыворотка', '5 флаконов по 5 мл', 'Описание.'), 'a.docx', 'ISSEIMI'))
    expect(report.matched.map((m) => m.slug)).toEqual(['aquao3-gf'])
    expect(report.matched[0].warnings).toEqual([])
  })

  it('K & B из файла совпадает с K&B на сайте', () => {
    const report = run(parse(card('K & B BUTTER CREAM Крем', 'Объем: 300 мл', 'Описание.'), 'a.docx', 'ISSEIMI'))
    expect(report.matched.map((m) => m.slug)).toEqual(['kb'])
  })

  it('PEEL -OFF MASK по алиасу попадает в маску PEEL OFF VITAMINA C', () => {
    const report = run(parse(card('PEEL -OFF MASK Маска с витамином С', 'Объем: 200 мл', 'Описание.'), 'a.docx', 'ISSEIMI'))
    expect(report.matched.map((m) => m.slug)).toEqual(['mascarilla-peel-off-vitamina-c-maska-s-vitaminom-s-alginatnaya'])
    expect(report.rules.join(' ')).toContain('алиас')
  })

  it('бренд важнее совпадения имени: GEN ADN из файла ISSEIMI не привязывается к GLACÉE', () => {
    const report = run(parse(card('GEN ADN – Крем', 'Объем: 50 мл', 'Описание.'), 'a.docx', 'ISSEIMI'))
    expect(report.matched).toEqual([])
    expect(report.pending.map((p) => p.key)).toEqual(['genadn'])
  })

  it('товар без совпадения уходит в ожидание, а не в угаданную карточку', () => {
    const report = run(parse(card('SEA FOAM – Пенка', 'Объем: 150 мл', 'Описание.'), 'a.docx', 'ISSEIMI'))
    expect(report.matched).toEqual([])
    expect(report.pending.map((p) => p.key)).toEqual(['seafoam'])
  })
})

describe('объём и кабинетные фасовки', () => {
  it('основная запись по розничному объёму, кабинетная по объёму из варианта', () => {
    const report = run(
      parse(
        [
          ...card('EMULSION HIGIENIZANTE - Крем', 'Объем: 200 мл', 'Описание розницы.'),
          ...card('EMULSION HIGIENIZANTE - Крем', 'Объем: 1000 мл', 'Описание кабинета.'),
        ],
        'part1.docx',
        'ISSEIMI',
      ),
    )
    const [unit] = report.matched
    expect(unit.slug).toBe('emulsion')
    expect(unit.sources.map((s) => s.role)).toEqual(['primary', 'cabinet'])
    expect(unit.details.pro?.volumeLabel).toBe('1000 мл')
    expect(unit.details.tagline).toEqual(['Описание розницы. Короткое описание.'])
    expect(unit.details.pro?.tagline).toEqual(['Описание кабинета. Короткое описание.'])
    expect(unit.details.pro?.howItWorks).toBeNull()
  })

  it('кабинетная запись без розничной становится основной, её применение — в pro.usage', () => {
    const report = run(
      parse(
        ['NATURAL CLEANSING MILK Натуральный крем', 'Объем: 500 мл', 'Описание.', 'Как работает формула:', '* Пункт.', 'СПОСОБ ПРИМЕНЕНИЯ:', 'Наносить на лицо.'],
        'part3.docx',
        'ISSEIMI',
      ),
    )
    const [unit] = report.matched
    expect(unit.sources.map((s) => s.role)).toEqual(['primary'])
    expect(unit.details.usage).toBeNull()
    expect(unit.details.pro?.volumeLabel).toBe('500 мл')
    expect(unit.details.pro?.usage?.steps[0].text).toBe('Наносить на лицо.')
    expect(unit.warnings.join(' ')).toContain('стала основной')
  })

  it('объём, не совпавший с сайтом, пишется как основная с предупреждением', () => {
    const report = run(parse(card('GEN ADN – Крем', 'Объем: 75 мл', 'Описание.'), 'glacee.docx', 'GLACÉE Skincare'))
    expect(report.matched[0].sources[0].role).toBe('primary')
    expect(report.matched[0].warnings.join(' ')).toContain('записано как основная')
  })
})

describe('точность и неоднозначность', () => {
  const products: SiteProduct[] = [
    { slug: 'tts-o3', name: 'TTS O3 Маска', brand: 'ISSEIMI', kind: 'retail', volume: null },
    { slug: 'tts-o3-ozono', name: 'TTS O3 OZONO Кислородная маска', brand: 'ISSEIMI', kind: 'retail', volume: null },
  ]

  it('точное совпадение важнее префикса по словам', () => {
    const report = run(parse(card('TTS O3 – Маска', 'Монодоза: 1 маска.', 'Описание.'), 'a.docx', 'ISSEIMI'), products, [])
    expect(report.matched.map((m) => m.slug)).toEqual(['tts-o3'])
    expect(report.warnings).toEqual([])
  })

  it('без точного совпадения — префикс по границе слова, с предупреждением', () => {
    const onlyLong = products.slice(1)
    const report = run(parse(card('TTS O3 – Маска', 'Монодоза: 1 маска.', 'Описание.'), 'a.docx', 'ISSEIMI'), onlyLong, [])
    expect(report.matched.map((m) => m.slug)).toEqual(['tts-o3-ozono'])
    expect(report.warnings.join(' ')).toContain('по префиксу')
  })

  it('два кандидата по префиксу — неоднозначно, карточка не угадывается', () => {
    const forte: SiteProduct[] = [
      { slug: 'a', name: 'TTS O3 OZONO Маска', brand: 'ISSEIMI', kind: 'retail', volume: null },
      { slug: 'b', name: 'TTS O3 FORTE Маска', brand: 'ISSEIMI', kind: 'retail', volume: null },
    ]
    const report = run(parse(card('TTS O3 – Маска', 'Монодоза: 1 маска.', 'Описание.'), 'a.docx', 'ISSEIMI'), forte, [])
    expect(report.matched).toEqual([])
    expect(report.problems.join(' ')).toContain('неоднозначно')
  })

  it('две основные записи для одного товара — конфликт, карточка не пишется', () => {
    const report = run(
      parse(
        [...card('EMULSION HIGIENIZANTE – Крем', 'Объем: 200 мл', 'Один.'), ...card('EMULSION HIGIENIZANTE – Крем', 'Объем: 200 мл', 'Два.')],
        'part1.docx',
        'ISSEIMI',
      ),
    )
    expect(report.matched).toEqual([])
    expect(report.problems.join(' ')).toContain('две основные записи')
  })

  it('товары сайта без текста попадают в noText, включая наборы без ключа', () => {
    const report = run(parse(card('EMULSION HIGIENIZANTE – Крем', 'Объем: 200 мл', 'Описание.'), 'a.docx', 'ISSEIMI'))
    expect(report.noText).toContain('veevenom')
    expect(report.noText).not.toContain('emulsion')
  })
})
