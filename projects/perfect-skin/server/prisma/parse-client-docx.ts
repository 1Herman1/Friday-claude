import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseDocx,
  parseVolume,
  type ParsedRecord,
} from '../src/lib/product-docx.parse.js'
import {
  ALIASES,
  matchAll,
  type CabinetVariant,
  type MatchedUnit,
  type MatchReport,
  type PendingUnit,
  type SiteProduct,
} from '../src/lib/product-docx.match.js'
import { ProductDetailsSchema, type ProductDetails } from '../src/lib/product-details.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ASSETS = path.join(__dirname, '../assets')
const OUT_DIR = path.join(ASSETS, 'product-details')
const PENDING_DIR = path.join(OUT_DIR, '_pending')
const CONTENT_DIR = path.join(__dirname, '../../../../docs/projects/perfect-skin/content')
const SOURCE_DIR = path.join(CONTENT_DIR, 'source')
const REPORT_MD = path.join(CONTENT_DIR, 'details-report.md')

const SOURCES = [
  { file: 'isseimi-part1.docx', brand: 'ISSEIMI' },
  { file: 'isseimi-part2.docx', brand: 'ISSEIMI' },
  { file: 'isseimi-part3.docx', brand: 'ISSEIMI' },
  { file: 'glacee.docx', brand: 'GLACÉE Skincare' },
] as const

interface CatalogFile {
  products: Array<{ slug: string; name: string; brand: string; volume: number | null }>
}

interface ProFile {
  products: Array<{ slug: string; name: string; brand: string; volume: { label: string } }>
  variantsForExisting: Array<{ siteName: string; volume: { label: string } }>
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

function loadSite(): { products: SiteProduct[]; variants: CabinetVariant[] } {
  const catalog = readJson<CatalogFile>(path.join(ASSETS, 'catalog-curated.json'))
  const pro = readJson<ProFile>(path.join(ASSETS, 'pro-products.json'))
  const products: SiteProduct[] = [
    ...catalog.products.map((p) => ({
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      kind: 'retail' as const,
      volume: typeof p.volume === 'number' ? { count: 1, each: p.volume, unit: null } : null,
    })),
    ...pro.products.map((p) => ({
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      kind: 'pro' as const,
      volume: parseVolume(p.volume.label),
    })),
  ]
  const variants = pro.variantsForExisting.flatMap((v) => {
    const volume = parseVolume(v.volume.label)
    return volume ? [{ siteName: v.siteName, volume }] : []
  })
  return { products, variants }
}

function writeJson(file: string, value: unknown): string {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
  return file
}

function removeStale(dir: string, keep: Set<string>): void {
  if (!fs.existsSync(dir)) return
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    if (name.endsWith('.json') && !keep.has(full)) fs.unlinkSync(full)
  }
}

function texts(details: ProductDetails): string[] {
  const out: string[] = []
  const walk = (value: unknown): void => {
    if (typeof value === 'string') out.push(value)
    else if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(details)
  return out
}

const KNOWN_TYPOS: Array<[RegExp, string]> = [
  [/Витамие/, '«Витамие» — вероятно «Витамин»'],
  [/АНТИВОЗРАСНОЙ/, '«АНТИВОЗРАСНОЙ» — вероятно «АНТИВОЗРАСТНОЙ»'],
  [/элексир/i, '«элексир» — вероятно «эликсир»'],
  [/в соответствие с/i, '«в соответствие с» — вероятно «в соответствии с»'],
  [/Обьем/, '«Обьем» — в остальных местах «Объем»'],
  [/Лайв-хак/, '«Лайв-хак» и «Лайф-хак» — разное написание одного заголовка'],
]

function suspiciousSpots(where: string, text: string): string[] {
  const spots: string[] = KNOWN_TYPOS.filter(([re]) => re.test(text)).map(([, note]) => `${where}: ${note}`)
  for (const token of text.match(/[\p{L}\p{N}]+/gu) ?? []) {
    if (/\p{Script=Cyrillic}/u.test(token) && /\p{Script=Latin}/u.test(token)) {
      spots.push(`${where}: смесь алфавитов в слове «${token}»`)
    }
  }
  const missingSpace = /[\p{L}][.!?,;][\p{Lu}]/gu.exec(text)
  if (missingSpace) spots.push(`${where}: нет пробела после знака: «…${text.slice(Math.max(0, missingSpace.index - 15), missingSpace.index + 20)}…»`)
  const spaceBefore = / [,.;:!?](?!\s*$)/.exec(text)
  if (spaceBefore) spots.push(`${where}: пробел перед знаком: «…${text.slice(Math.max(0, spaceBefore.index - 20), spaceBefore.index + 15)}…»`)
  const doubled = /(?<!\p{L})(\p{L}+) \1(?!\p{L})/iu.exec(text)
  if (doubled) spots.push(`${where}: повтор слова «${doubled[1]} ${doubled[1]}»`)
  return spots
}

function sourceLine(s: { file: string; title: string; volumeLine: string; role: string }): string {
  return `${s.file} «${s.title}»${s.volumeLine ? ` [${s.volumeLine}]` : ''} (${s.role})`
}

function renderReport(args: {
  site: SiteProduct[]
  report: MatchReport
  orphans: string[]
  fileRules: string[]
  records: ParsedRecord[]
  typos: string[]
}): string {
  const { site, report, orphans, fileRules, records, typos } = args
  const siteBySlug = new Map(site.map((p) => [p.slug, p]))
  const matchedRetail = report.matched.filter((m) => siteBySlug.get(m.slug)?.kind === 'retail')
  const matchedPro = report.matched.filter((m) => siteBySlug.get(m.slug)?.kind === 'pro')
  const noTextRetail = report.noText.filter((s) => siteBySlug.get(s)?.kind === 'retail')
  const noTextPro = report.noText.filter((s) => siteBySlug.get(s)?.kind === 'pro')
  const warnings = [
    ...report.matched.flatMap((m) => m.warnings.map((w) => `${m.slug}: ${w}`)),
    ...report.pending.flatMap((p) => p.warnings.map((w) => `_pending/${p.key}: ${w}`)),
    ...report.warnings,
  ]
  const lines: string[] = []
  const section = (title: string, items: string[]): void => {
    lines.push(`## ${title} (${items.length})`, '')
    if (items.length === 0) lines.push('Нет.', '')
    else lines.push(...items.map((i) => `- ${i}`), '')
  }

  lines.push('# Описания товаров: сопоставление с сайтом', '')
  lines.push(
    'Исходники: `source/` (см. `SOURCES.md`). Файлы строит `npm run parse:client-docx` в `server/`; повторный прогон не меняет выход.',
    '',
  )
  lines.push('## Итоги', '')
  lines.push(`- Позиций в файлах клиента: ${records.length} (товаров ${records.filter((r) => r.kind === 'product').length}, дополнений ${records.filter((r) => r.kind === 'amendment').length})`)
  lines.push(`- Товаров на сайте: ${site.length} (розница ${site.filter((p) => p.kind === 'retail').length}, кабинетные ${site.filter((p) => p.kind === 'pro').length})`)
  lines.push(`- Совпало с текстом: ${report.matched.length} (розница ${matchedRetail.length}, кабинетные ${matchedPro.length})`)
  lines.push(`- Товаров сайта без текста: ${report.noText.length} (розница ${noTextRetail.length}, кабинетные ${noTextPro.length})`)
  lines.push(`- Позиций из файлов, которых нет на сайте (отложено в \`_pending/\`): ${report.pending.length}`)
  lines.push(`- Неоднозначных и конфликтов: ${report.problems.length}`)
  lines.push(`- Предупреждений: ${warnings.length}`)
  lines.push(`- Подозрительных мест в тексте: ${typos.length}`, '')

  section(
    'Совпало: slug ← источник',
    report.matched.map((m) => `\`${m.slug}\` ← ${m.sources.map(sourceLine).join('; ')}`),
  )
  section(
    'Нет на сайте (отложено, не заводим)',
    report.pending.map((p: PendingUnit) => `\`${p.key}\` ← ${p.sources.map(sourceLine).join('; ')}`),
  )
  section(
    'Товары сайта без текста',
    report.noText.map((slug) => {
      const p = siteBySlug.get(slug)
      return `\`${slug}\`${p ? ` — ${p.name}` : ''}`
    }),
  )
  section('Неоднозначные и конфликты', report.problems)
  section('Применённые правила', [
    ...Object.keys(ALIASES).map((k) => `алиас «${k}» → ${ALIASES[k]}`),
    ...report.rules,
    ...records.flatMap((r) => r.rules.map((rule) => `${r.file}: ${rule}`)),
    ...fileRules,
    'Заголовки и маркеры: NBSP и повторные пробелы схлопнуты, маркеры 💡 ◀ • удалены, текст не правился',
    'Строки «…» и точек — границы блоков; INCI («Состав (INCI)») не сохраняется',
    'Заголовки секций: регистр, ё, латинская C вместо кириллической С («Cпособ» → «Способ»), двоеточие необязательно',
    'Двойные «Кому подойдёт», «Как работает» и «Активные ингредиенты» в одном блоке — слиты без дублей',
  ])
  section(
    'Не сопоставлено с текстом из файла: строки вне товаров',
    orphans.map((o) => `«${o.slice(0, 120)}»`),
  )
  section('Предупреждения', warnings)
  section('Подозрительные места в тексте клиента (не исправлялись)', typos)
  return `${lines.join('\n')}\n`
}

function main(): void {
  const { products: site, variants } = loadSite()
  const records: ParsedRecord[] = []
  const orphans: string[] = []
  const fileRules: string[] = []

  for (const src of SOURCES) {
    const buffer = fs.readFileSync(path.join(SOURCE_DIR, src.file))
    const sha1 = crypto.createHash('sha1').update(buffer).digest('hex')
    const parsed = parseDocx(buffer, { file: src.file, sha1, brand: src.brand })
    records.push(...parsed.records)
    orphans.push(...parsed.orphans.map((o) => `${src.file}: ${o}`))
    fileRules.push(...parsed.fileRules.map((r) => `${src.file}: ${r}`))
  }

  const report = matchAll(records, site, variants)
  const typos = [
    ...records.flatMap((r) => suspiciousSpots(`${r.file} «${r.title}»`, [r.title, r.volumeLine, ...(r.details ? texts(r.details) : r.amendmentNotes)].join(' | '))),
  ]

  fs.mkdirSync(PENDING_DIR, { recursive: true })
  const written = new Set<string>()
  const writeUnit = (dir: string, file: string, value: unknown): void => {
    written.add(writeJson(path.join(dir, file), value))
  }
  for (const unit of report.matched as MatchedUnit[]) {
    writeUnit(OUT_DIR, `${unit.slug}.json`, {
      slug: unit.slug,
      sources: unit.sources,
      warnings: unit.warnings,
      details: ProductDetailsSchema.parse(unit.details),
    })
  }
  for (const unit of report.pending) {
    writeUnit(PENDING_DIR, `${unit.key}.json`, {
      key: unit.key,
      brand: unit.brand,
      sources: unit.sources,
      warnings: unit.warnings,
      details: ProductDetailsSchema.parse(unit.details),
    })
  }
  writeUnit(OUT_DIR, '_report.json', {
    matched: report.matched.map((m) => m.slug),
    pending: report.pending.map((p) => p.key),
    noText: report.noText,
    problems: report.problems,
    warnings: report.warnings,
    typos,
  })
  removeStale(OUT_DIR, written)
  removeStale(PENDING_DIR, written)
  fs.writeFileSync(
    REPORT_MD,
    renderReport({ site, report, orphans, fileRules, records, typos }),
  )

  console.log(`совпало: ${report.matched.length}, нет на сайте: ${report.pending.length}, без текста: ${report.noText.length}, проблем: ${report.problems.length}`)
}

main()
