import * as zlib from 'node:zlib'
import { replaceCyrillicLookalikes } from './import-prices.match.js'
import { ProductDetailsSchema, type ProductDetails } from './product-details.js'

export interface VolumeSpec {
  count: number
  each: number
  unit: string | null
}

export interface ParsedRecord {
  kind: 'product' | 'amendment'
  file: string
  sha1: string
  brand: string
  key: string
  name: string
  title: string
  volumeLine: string
  volume: VolumeSpec | null
  details: ProductDetails | null
  amendmentNotes: string[]
  warnings: string[]
  rules: string[]
}

export interface ParsedDocx {
  records: ParsedRecord[]
  orphans: string[]
  fileRules: string[]
}

interface RawLine {
  text: string
  bullet: boolean
}

interface CleanLine {
  kind: 'text' | 'sep' | 'zone'
  text: string
  bullet: boolean
}

interface RawRecord {
  kind: 'product' | 'amendment'
  header: string
  subtitle: string[]
  volumeLine: string
  body: CleanLine[]
  closed: boolean
}

interface Ctx {
  warnings: string[]
  rules: string[]
}

type Item = { title: string | null; text: string }
type HeadingKind = 'how' | 'result' | 'actives' | 'forWhom' | 'usage' | 'lifehack' | 'inci'
interface HowDraft {
  heading: string
  lead: string[]
  items: Item[]
  result: string[]
}
interface ForWhomDraft {
  lead: string[]
  items: string[]
  note: string[]
  hasBullet: boolean
}
interface UsageDraft {
  heading: string
  steps: Item[]
  notes: string[]
  caption: string | null
}
interface LifehackDraft {
  title: string | null
  paragraphs: string[]
}
interface ExtraDraft {
  heading: string
  paragraphs: string[]
  items: string[]
}
interface Heading {
  kind: HeadingKind
  title: string | null
  inline: string
}

const EXTRA_LOOKALIKES: Record<string, string> = { В: 'B', К: 'K', М: 'M', Н: 'H' }
const CYRILLIC_RE = /[Ѐ-ӿ]/
const LATIN_LETTER_RE = /\p{Script=Latin}/u
const VOLUME_RE =
  /^(объ[её]м|обьем)(?![а-яё])|^форма:|^монодоза:|^флакон|^\d+([.,]\d+)?\s*(мл|г|шт)\.?$|^\d+\s*флакон|^\d+\s*[хx×]\s*\d+\s*см/i
const ZONE_RE = /^препараты для профессионального применения$/i
const SKIP_RE = /^подобные маски уже были в части 2$/i
const BULLET_LEAD_RE = /^\s*[•\-–—▪◦●]/
const MARKER_RE = /[\u{1F4A1}\u{25C0}•▪►◆️]/gu
const CAPTION_MAX = 160
const AMENDMENT_RE = /^В этот препарат\s+/i
// Заголовки без строки объёма в файле клиента (объём — по прайсу); явный список, см. отчёт
const HEADERS_WITHOUT_VOLUME = new Set(['kbbuttercream'])

const LAT_TO_CYR: Record<string, string> = {
  a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', k: 'к', m: 'м', h: 'н', t: 'т', b: 'в',
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У',
}

const HEADING_RULES: Array<[HeadingKind, RegExp]> = [
  ['lifehack', /^(лайф|лайв)[ -]?хак|^лайфхак/],
  ['result', /^(видимый результат|результат применения)$/],
  ['forWhom', /^кому подойдет$/],
  ['usage', /^(способ|протокол) применения( и протокол)?$/],
  ['actives', /^(активные|основные|ключевые) (ингредиенты|компоненты|активы|активные компоненты)$/],
  ['how', /^(как работает.*|как это работает|ключевые механизмы( действия)?|механизмы действия|активная формула.*|сила активных компонентов)$/],
]

export function toLatinLookalikes(text: string): string {
  return replaceCyrillicLookalikes(text).replace(/[ВКМН]/g, (c) => EXTRA_LOOKALIKES[c] ?? c)
}

export function latinNameTokens(text: string): string[] {
  const out: string[] = []
  for (const tok of text.split(' ')) {
    if (!tok) continue
    if (/^[-–—]$/.test(tok)) break
    if (CYRILLIC_RE.test(toLatinLookalikes(tok))) break
    if (!LATIN_LETTER_RE.test(tok) && !/^[\d+&/]+$/.test(tok) && !/^\([^)]*\)$/.test(tok)) break
    out.push(tok)
  }
  return out
}

export function productKey(name: string): string {
  return toLatinLookalikes(name)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function nameWords(name: string): string[] {
  return latinNameTokens(name)
    .map((tok) => productKey(tok))
    .filter((w) => w.length > 0)
}

export function parseVolume(text: string): VolumeSpec | null {
  const multi = /(\d+)\s*(?:флаконов|флакона|флакон|шт\.?)?\s*(?:по|[×xх])\s*(\d+(?:[.,]\d+)?)\s*(мл|г)(?![а-яё])/i.exec(text)
  if (multi) {
    return { count: Number(multi[1]), each: Number(multi[2].replace(',', '.')), unit: multi[3].toLowerCase() }
  }
  const single = /(\d+(?:[.,]\d+)?)\s*(мл|г|шт)(?![а-яё])/i.exec(text)
  if (!single) return null
  return { count: 1, each: Number(single[1].replace(',', '.')), unit: single[2].toLowerCase() }
}

export function volumeLabel(spec: VolumeSpec): string {
  const unit = spec.unit ?? ''
  return spec.count > 1 ? `${spec.count} × ${spec.each} ${unit}` : `${spec.each} ${unit}`.trim()
}

export function sameVolume(a: VolumeSpec, b: VolumeSpec): boolean {
  return a.count === b.count && a.each === b.each && (a.unit === null || b.unit === null || a.unit === b.unit)
}

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function readZipEntry(buf: Buffer, name: string): Buffer {
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('не найден конец ZIP-архива: это не docx')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('повреждён каталог ZIP-архива')
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOffset = buf.readUInt32LE(p + 42)
    const entryName = buf.toString('utf8', p + 46, p + 46 + nameLen)
    if (entryName === name) {
      const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28)
      const data = buf.subarray(start, start + compSize)
      if (method === 0) return Buffer.from(data)
      if (method === 8) return zlib.inflateRawSync(data)
      throw new Error(`неподдерживаемый метод сжатия ZIP: ${method}`)
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  throw new Error(`в архиве нет ${name}`)
}

function paragraphLines(inner: string): RawLine[] {
  const numPr = /<w:numPr>([\s\S]*?)<\/w:numPr>/.exec(inner)
  const numId = numPr ? /<w:numId w:val="(\d+)"/.exec(numPr[1]) : null
  const bullet = numPr !== null && numId?.[1] !== '0'
  let text = ''
  for (const tok of inner.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>|<w:br\s[^>]*\/>|<w:cr\/>/g)) {
    if (tok[1] !== undefined) text += decodeXml(tok[1])
    else if (tok[0].startsWith('<w:tab')) text += ' '
    else text += '\n'
  }
  return text.split('\n').map((line, i) => ({ text: line, bullet: i === 0 && bullet }))
}

function readDocxLines(buffer: Buffer): RawLine[] {
  const xml = readZipEntry(buffer, 'word/document.xml').toString('utf8')
  const lines: RawLine[] = []
  for (const para of xml.matchAll(/<w:p\b[^>]*?(?:\/>|>([\s\S]*?)<\/w:p>)/g)) {
    lines.push(...paragraphLines(para[1] ?? ''))
  }
  return lines
}

function cleanLines(raw: RawLine[], hit: (rule: string) => void): CleanLine[] {
  const out: CleanLine[] = []
  for (const line of raw) {
    const bullet = line.bullet || BULLET_LEAD_RE.test(line.text)
    let text = line.text
    if (/[\u00a0\u2007\u202f]/.test(text)) hit('неразрывные пробелы заменены на обычные')
    text = text.replace(/[\u00a0\u2007\u202f]/g, ' ').replace(/[\u200b\ufeff]/g, '').replace(/\t/g, ' ')
    if (/конец формы|начало формы/i.test(text)) hit('мусор Word «Конец формы»/«Начало формы» удалён')
    text = text.replace(/конец формы|начало формы/gi, ' ')
    if (MARKER_RE.test(text)) hit('маркеры 💡 ◀ • удалены')
    MARKER_RE.lastIndex = 0
    text = text.replace(MARKER_RE, ' ').replace(/\s+/g, ' ').trim().replace(/^[-–—]+\s*/, '')
    if (!text) continue
    if (/^[.…]+$/.test(text)) {
      out.push({ kind: 'sep', text: '', bullet: false })
      continue
    }
    if (SKIP_RE.test(text)) {
      hit('«Подобные маски уже были в Части 2» пропущено')
      continue
    }
    if (ZONE_RE.test(text)) {
      hit('«ПРЕПАРАТЫ ДЛЯ ПРОФЕССИОНАЛЬНОГО ПРИМЕНЕНИЯ» — маркер зоны, не товар')
      out.push({ kind: 'zone', text: '', bullet: false })
      continue
    }
    out.push({ kind: 'text', text, bullet })
  }
  return out
}

function isNameStart(tokens: string[]): boolean {
  if (tokens.length === 0) return false
  if (LATIN_LETTER_RE.test(tokens[0])) return true
  return tokens.length > 1 && /^\d+$/.test(tokens[0]) && LATIN_LETTER_RE.test(tokens[1])
}

function findStart(lines: CleanLine[], i: number): { raw: RawRecord; next: number } | null {
  const line = lines[i]
  if (line.kind !== 'text') return null
  const amendment = AMENDMENT_RE.test(line.text)
  const header = amendment ? line.text.replace(AMENDMENT_RE, '') : line.text
  if (!isNameStart(latinNameTokens(header))) return null
  const subtitle: string[] = []
  let seen = 0
  for (let j = i + 1; j < lines.length && seen < 2; j++) {
    const next = lines[j]
    if (next.kind !== 'text') return null
    seen++
    if (VOLUME_RE.test(next.text)) {
      return {
        raw: {
          kind: amendment ? 'amendment' : 'product',
          header: line.text,
          subtitle,
          volumeLine: next.text,
          body: [],
          closed: false,
        },
        next: j + 1,
      }
    }
    subtitle.push(next.text)
  }
  if (!amendment && HEADERS_WITHOUT_VOLUME.has(productKey(latinNameTokens(header).join(' ')))) {
    const sub = lines[i + 1]
    const subtitleLine = sub?.kind === 'text' && !sub.text.includes(':') ? sub.text : null
    return {
      raw: { kind: 'product', header: line.text, subtitle: subtitleLine ? [subtitleLine] : [], volumeLine: '', body: [], closed: false },
      next: subtitleLine ? i + 2 : i + 1,
    }
  }
  return null
}

function splitRecords(lines: CleanLine[]): { records: RawRecord[]; orphans: string[] } {
  const records: RawRecord[] = []
  const orphans: string[] = []
  let current: RawRecord | null = null
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const start = findStart(lines, i)
    if (start) {
      current = start.raw
      records.push(current)
      i = start.next
      continue
    }
    i++
    if (line.kind === 'zone') {
      current = null
      continue
    }
    if (line.kind === 'sep') {
      if (current) current.closed = true
      continue
    }
    if (current && !current.closed) current.body.push(line)
    else orphans.push(line.text)
  }
  return { records, orphans }
}

function isCaption(text: string): boolean {
  return text.endsWith(':') && text.length > 1 && text.length <= CAPTION_MAX && !text.slice(0, -1).includes(':')
}

function captionHeading(text: string): string {
  return text.slice(0, -1).trim()
}

function splitItem(text: string): Item {
  const idx = text.indexOf(':')
  if (idx <= 0 || idx > 90) return { title: null, text }
  const head = text.slice(0, idx)
  const rest = text.slice(idx + 1).trim()
  if (head.includes('.') || rest === '') return { title: null, text }
  return { title: head.trim(), text: rest }
}

function cyrWords(text: string): string {
  return text.replace(/./gu, (c) => LAT_TO_CYR[c] ?? c)
}

function headingKey(text: string): string {
  return cyrWords(text)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .replace(/[.:…\s]+$/, '')
    .trim()
}

function detectHeading(text: string): Heading | null {
  const colon = text.indexOf(':')
  const head = (colon >= 0 ? text.slice(0, colon) : text).trim()
  if (/^состав\s*\(?\s*inci/i.test(head)) return { kind: 'inci', title: null, inline: colon >= 0 ? text.slice(colon + 1).trim() : '' }
  const key = headingKey(head)
  const rule = HEADING_RULES.find(([, re]) => re.test(key))
  if (!rule) return null
  const kind = rule[0]
  if (kind === 'lifehack') {
    if (colon < 0 || head.length > CAPTION_MAX) return { kind, title: null, inline: text }
    return { kind, title: cyrWords(head), inline: text.slice(colon + 1).trim() }
  }
  if (head.length > 60) return null
  return { kind, title: cyrWords(head), inline: colon >= 0 ? text.slice(colon + 1).trim() : '' }
}

function clampLines(lines: string[], max: number, what: string, ctx: Ctx): string[] {
  if (lines.length <= max) return lines
  ctx.warnings.push(`${what}: строк больше ${max}, хвост склеен в одну`)
  return [...lines.slice(0, max - 1), lines.slice(max - 1).join('\n')]
}

function clampItems(items: Item[], max: number, what: string, ctx: Ctx): Item[] {
  if (items.length <= max) return items
  ctx.warnings.push(`${what}: пунктов больше ${max}, хвост склеен в один`)
  const head = items.slice(0, max - 1)
  const tail = items.slice(max - 1)
  return [...head, { title: tail[0].title, text: tail.map((i) => (i.title ? `${i.title}: ${i.text}` : i.text)).join('\n') }]
}

function uniq(lines: string[]): string[] {
  return [...new Set(lines)]
}

function uniqItems(items: Item[]): Item[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = JSON.stringify(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

type Section = 'intro' | 'how' | 'result' | 'actives' | 'forWhom' | 'usage' | 'lifehack' | 'inci' | 'extra'

function parseBody(body: CleanLine[], ctx: Ctx): ProductDetails {
  let section: Section = 'intro'
  let introLong = false
  const tagline: string[] = []
  const intro: string[] = []
  const extras: ExtraDraft[] = []
  let how = null as HowDraft | null
  const actives: string[] = []
  let forWhom = null as ForWhomDraft | null
  let usage = null as UsageDraft | null
  let lifehack = null as LifehackDraft | null
  const opened = new Set<HeadingKind>()
  let inciWarned = false

  const newExtra = (heading: string): ExtraDraft => {
    const extra: ExtraDraft = { heading, paragraphs: [], items: [] }
    extras.push(extra)
    return extra
  }
  const lastExtra = (): ExtraDraft => extras[extras.length - 1] ?? newExtra('')
  const flushCaption = (): void => {
    if (usage?.caption) {
      usage.notes.push(usage.caption)
      usage.caption = null
    }
  }
  const ensureHow = (heading: string): HowDraft => {
    how ??= { heading, lead: [], items: [], result: [] }
    return how
  }
  const ensureForWhom = (): ForWhomDraft => {
    forWhom ??= { lead: [], items: [], note: [], hasBullet: false }
    return forWhom
  }
  const ensureUsage = (heading: string): UsageDraft => {
    usage ??= { heading, steps: [], notes: [], caption: null }
    return usage
  }
  const ensureLifehack = (title: string | null): LifehackDraft => {
    lifehack ??= { title, paragraphs: [] }
    return lifehack
  }

  const addUsage = (text: string, bullet: boolean): void => {
    const u = ensureUsage('')
    if (!bullet && isCaption(text)) {
      flushCaption()
      u.caption = captionHeading(text)
      return
    }
    const item = splitItem(text)
    if (u.caption === null) {
      u.steps.push(item)
      return
    }
    if (item.title !== null) {
      u.notes.push(u.caption)
      u.steps.push(item)
    } else {
      u.steps.push({ title: u.caption, text: item.text })
    }
    u.caption = null
  }

  const addLine = (text: string, bullet: boolean): void => {
    switch (section) {
      case 'intro': {
        if (!bullet && isCaption(text)) {
          newExtra(captionHeading(text))
          section = 'extra'
          return
        }
        if (bullet) {
          newExtra('').items.push(text)
          section = 'extra'
          return
        }
        const idx = text.indexOf(':')
        const head = idx > 0 ? text.slice(0, idx).trim() : ''
        if (head && head.length <= 60 && !head.includes('.') && text.slice(idx + 1).trim() && text.length <= 300) {
          newExtra(head).paragraphs.push(text.slice(idx + 1).trim())
          section = 'extra'
          return
        }
        if (!introLong && text.length < 200) {
          tagline.push(text)
          return
        }
        introLong = true
        intro.push(text)
        return
      }
      case 'how': {
        const h = ensureHow('')
        const last = h.items[h.items.length - 1] as Item | undefined
        if (!bullet && last && /^[a-zа-яё]/.test(text)) {
          last.text = `${last.text} ${text}`
          ctx.rules.push('строка-продолжение склеена с предыдущим пунктом «как работает»')
          return
        }
        if (bullet || h.items.length > 0) h.items.push(splitItem(text))
        else h.lead.push(text)
        return
      }
      case 'result':
        ensureHow('').result.push(text)
        return
      case 'actives':
        actives.push(text)
        return
      case 'forWhom': {
        const f = ensureForWhom()
        if (bullet) {
          f.hasBullet = true
          f.items.push(text)
        } else if (f.hasBullet) {
          f.note.push(text)
        } else {
          f.lead.push(text)
        }
        return
      }
      case 'usage':
        addUsage(text, bullet)
        return
      case 'lifehack':
        ensureLifehack(null).paragraphs.push(text)
        return
      case 'extra': {
        if (!bullet && isCaption(text)) {
          newExtra(captionHeading(text))
          return
        }
        if (bullet) {
          lastExtra().items.push(text)
          return
        }
        const e = lastExtra()
        if (e.items.length > 0) newExtra('').paragraphs.push(text)
        else e.paragraphs.push(text)
        return
      }
      case 'inci':
        if (!inciWarned && !/^[.…\s]*$/.test(text)) {
          inciWarned = true
          ctx.warnings.push(`после «Состав (INCI)» идёт текст, он не сохранён: «${text.slice(0, 60)}…»`)
        }
        return
    }
  }

  const open = (hit: Heading): void => {
    flushCaption()
    if (opened.has(hit.kind) && hit.kind !== 'lifehack') {
      ctx.warnings.push(`повтор секции «${hit.title ?? hit.kind}» — слита с предыдущей`)
    }
    opened.add(hit.kind)
    switch (hit.kind) {
      case 'how': {
        const h = ensureHow(hit.title ?? '')
        if (!h.heading) h.heading = hit.title ?? ''
        section = 'how'
        break
      }
      case 'result': {
        const h = ensureHow('')
        if (!h.heading) h.heading = hit.title ?? ''
        section = 'result'
        break
      }
      case 'actives':
        section = 'actives'
        break
      case 'forWhom':
        ensureForWhom()
        section = 'forWhom'
        break
      case 'usage':
        ensureUsage(hit.title ?? '')
        section = 'usage'
        break
      case 'lifehack':
        if (lifehack) ctx.warnings.push('повтор секции «Лайфхак» — абзацы слиты')
        ensureLifehack(hit.title)
        section = 'lifehack'
        break
      case 'inci':
        section = 'inci'
        break
    }
    if (hit.inline) {
      if (hit.kind === 'lifehack' || hit.kind === 'result' || hit.kind === 'actives') {
        if (hit.kind === 'lifehack') ensureLifehack(hit.title).paragraphs.push(hit.inline)
        else if (hit.kind === 'result') ensureHow('').result.push(hit.inline)
        else actives.push(hit.inline)
      } else if (hit.kind === 'inci') {
        if (!/^[.…\s]*$/.test(hit.inline)) ctx.warnings.push(`«Состав (INCI)» с текстом пропущен: «${hit.inline.slice(0, 60)}»`)
      } else {
        addLine(hit.inline, false)
      }
    }
  }

  for (const line of body) {
    const hit = detectHeading(line.text)
    if (hit) open(hit)
    else addLine(line.text, line.bullet)
  }
  flushCaption()

  const extraList = extras
    .filter((e) => e.heading || e.paragraphs.length > 0 || e.items.length > 0)
    .map((e) => ({ heading: e.heading, paragraphs: clampLines(e.paragraphs, 6, 'дополнительный блок', ctx), items: clampLines(e.items, 12, 'дополнительный блок', ctx) }))
  if (extraList.length > 4) ctx.warnings.push(`дополнительных блоков больше 4: ${extraList.length}`)

  const howItWorks =
    how && (how.heading || how.lead.length > 0 || how.items.length > 0 || how.result.length > 0)
      ? {
          heading: how.heading,
          lead: clampLines(how.lead, 4, 'как работает: вступление', ctx),
          items: clampItems(uniqItems(how.items), 10, 'как работает', ctx),
          result: how.result.length > 0 ? how.result.join('\n') : null,
        }
      : null

  let forWhomValue: ProductDetails['forWhom'] = null
  if (forWhom) {
    const f = forWhom
    const items = uniq(f.hasBullet ? f.items : f.lead)
    const lead = f.hasBullet && f.lead.length > 0 ? f.lead.join('\n') : null
    if (items.length > 0) {
      forWhomValue = {
        lead,
        items: clampLines(items, 14, 'кому подойдёт', ctx),
        note: clampLines(uniq(f.note), 3, 'кому подойдёт: примечания', ctx),
      }
    }
  }

  let usageValue: ProductDetails['usage'] = null
  if (usage) {
    const u = usage
    let steps = u.steps
    let notes = u.notes
    if (steps.length === 0 && notes.length > 0) {
      steps = notes.map((text) => ({ title: null, text }))
      notes = []
    }
    if (steps.length > 0) {
      usageValue = {
        heading: u.heading,
        steps: clampItems(steps, 14, 'способ применения', ctx),
        notes: clampLines(notes, 4, 'способ применения: примечания', ctx),
      }
    } else {
      ctx.warnings.push('секция «Способ применения» пуста')
    }
  }

  let lifehackValue: ProductDetails['lifehack'] = null
  if (lifehack) {
    const paragraphs = uniq(lifehack.paragraphs)
    if (paragraphs.length > 0) {
      lifehackValue = { title: lifehack.title, paragraphs: clampLines(paragraphs, 6, 'лайфхак', ctx) }
    } else {
      ctx.warnings.push('лайфхак без текста: заголовок есть, абзацев нет')
    }
  }

  return {
    v: 1,
    tagline: clampLines(tagline, 3, 'короткое описание', ctx),
    intro: clampLines(intro, 12, 'описание', ctx),
    extra: extraList.slice(0, 4),
    howItWorks,
    actives: clampLines(uniq(actives), 20, 'активные ингредиенты', ctx),
    forWhom: forWhomValue,
    usage: usageValue,
    lifehack: lifehackValue,
    pro: null,
  }
}

function buildRecord(raw: RawRecord, meta: { file: string; sha1: string; brand: string }): ParsedRecord {
  const ctx: Ctx = { warnings: [], rules: [] }
  if (!raw.volumeLine) ctx.warnings.push('в файле нет строки объёма: объём берётся из прайса')
  const name = latinNameTokens(raw.header.replace(AMENDMENT_RE, '')).join(' ')
  const key = productKey(name)
  const title = [raw.header, ...raw.subtitle].join(' ')
  const volume = parseVolume(raw.volumeLine)
  let body = raw.body
  if (raw.kind === 'product' && key === 'fluvix' && volume?.each === 15) {
    const cut = body.findIndex((l) => /^Инновационный космецевтический препарат/.test(l.text))
    if (cut >= 0) {
      ctx.rules.push(`FLUVIX 15 мл: обрезана вклейка 30 мл (${body.length - cut} строк)`)
      body = body.slice(0, cut)
    }
  }
  const base = { file: meta.file, sha1: meta.sha1, brand: meta.brand, key, name, title, volumeLine: raw.volumeLine, volume }
  if (raw.kind === 'amendment') {
    const notes = clampLines(
      body.map((l) => l.text),
      4,
      'дополнение',
      ctx,
    )
    if (notes.length === 0) ctx.warnings.push('дополнение без текста')
    return { ...base, kind: 'amendment', details: null, amendmentNotes: notes, warnings: ctx.warnings, rules: ctx.rules }
  }
  const parsed = parseBody(body, ctx)
  const check = ProductDetailsSchema.safeParse(parsed)
  if (!check.success) {
    ctx.warnings.push(`карточка не проходит схему: ${check.error.issues[0]?.message ?? 'ошибка'}`)
    return { ...base, kind: 'product', details: null, amendmentNotes: [], warnings: ctx.warnings, rules: ctx.rules }
  }
  return { ...base, kind: 'product', details: check.data, amendmentNotes: [], warnings: ctx.warnings, rules: ctx.rules }
}

export function parseDocx(buffer: Buffer, meta: { file: string; sha1: string; brand: string }): ParsedDocx {
  const hits = new Map<string, number>()
  const hit = (rule: string): void => {
    hits.set(rule, (hits.get(rule) ?? 0) + 1)
  }
  const lines = cleanLines(readDocxLines(buffer), hit)
  const { records, orphans } = splitRecords(lines)
  return {
    records: records.map((raw) => buildRecord(raw, meta)),
    orphans,
    fileRules: [...hits.entries()].map(([rule, count]) => `${rule} (${count})`),
  }
}
