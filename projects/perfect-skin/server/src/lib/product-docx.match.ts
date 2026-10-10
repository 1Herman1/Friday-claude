import { ProductDetailsSchema, type ProductDetails } from './product-details.js'
import {
  latinNameTokens,
  nameWords,
  productKey,
  sameVolume,
  volumeLabel,
  type ParsedRecord,
  type VolumeSpec,
} from './product-docx.parse.js'

export const ALIASES: Record<string, string> = {
  peeloffmask: 'mascarilla-peel-off-vitamina-c-maska-s-vitaminom-s-alginatnaya',
}

export interface SiteProduct {
  slug: string
  name: string
  brand: string
  kind: 'retail' | 'pro'
  volume: VolumeSpec | null
}

export interface CabinetVariant {
  siteName: string
  volume: VolumeSpec
}

export interface SourceRef {
  file: string
  sha1: string
  title: string
  volumeLine: string
  role: 'primary' | 'cabinet' | 'amendment'
}

export interface MatchedUnit {
  slug: string
  sources: SourceRef[]
  warnings: string[]
  details: ProductDetails
}

export interface PendingUnit {
  key: string
  brand: string
  sources: SourceRef[]
  warnings: string[]
  details: ProductDetails
}

export interface MatchReport {
  matched: MatchedUnit[]
  pending: PendingUnit[]
  problems: string[]
  noText: string[]
  warnings: string[]
  rules: string[]
}

interface Entry {
  product: SiteProduct
  key: string
  words: string[]
  cabinet: VolumeSpec[]
}

export function brandKey(brand: string): string {
  return brand.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function buildEntries(site: SiteProduct[], variants: CabinetVariant[], report: MatchReport): Entry[] {
  const entries: Entry[] = site.map((product) => ({
    product,
    key: productKey(latinNameTokens(product.name).join(' ')),
    words: nameWords(product.name),
    cabinet: [],
  }))
  for (const variant of variants) {
    const key = productKey(variant.siteName)
    const found = entries.filter((e) => e.key === key)
    if (found.length !== 1) {
      report.warnings.push(`кабинетная фасовка «${variant.siteName}» не привязана к товару сайта: найдено ${found.length}`)
      continue
    }
    found[0].cabinet.push(variant.volume)
  }
  return entries
}

function findEntries(entries: Entry[], brand: string, key: string, words: string[]): { exact: Entry[]; prefix: Entry[] } {
  const sameBrand = entries.filter((e) => brandKey(e.product.brand) === brandKey(brand))
  const exact = sameBrand.filter((e) => e.key === key)
  if (exact.length > 0) return { exact, prefix: [] }
  const prefix = sameBrand.filter(
    (e) => words.length > 0 && e.words.length > words.length && words.every((w, i) => e.words[i] === w),
  )
  return { exact: [], prefix }
}

function roleOf(rec: ParsedRecord, entry: Entry): 'primary' | 'cabinet' {
  const volume = rec.volume
  if (entry.product.kind === 'pro' || !volume) return 'primary'
  if (entry.product.volume && sameVolume(volume, entry.product.volume)) return 'primary'
  if (entry.cabinet.some((v) => sameVolume(volume, v))) return 'cabinet'
  return 'primary'
}

function diffPro(cabinet: ParsedRecord, main: ProductDetails): NonNullable<ProductDetails['pro']> {
  const c = cabinet.details
  if (!c || !cabinet.volume) throw new Error('кабинетная запись без карточки или объёма')
  const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
  return {
    volumeLabel: volumeLabel(cabinet.volume),
    tagline: same(c.tagline, main.tagline) ? [] : c.tagline,
    intro: same(c.intro, main.intro) ? [] : c.intro,
    howItWorks: same(c.howItWorks, main.howItWorks) ? null : c.howItWorks,
    forWhom: same(c.forWhom, main.forWhom) ? null : c.forWhom,
    actives: same(c.actives, main.actives) ? [] : c.actives,
    usage: same(c.usage, main.usage) ? null : c.usage,
  }
}

function clampNotes(notes: string[]): string[] {
  if (notes.length <= 4) return notes
  return [...notes.slice(0, 3), notes.slice(3).join('\n')]
}

const ROLE_ORDER: Record<SourceRef['role'], number> = { primary: 0, cabinet: 1, amendment: 2 }

function sourceOf(rec: ParsedRecord, role: SourceRef['role']): SourceRef {
  return { file: rec.file, sha1: rec.sha1, title: rec.title, volumeLine: rec.volumeLine, role }
}

function sortSources(sources: SourceRef[]): SourceRef[] {
  return [...sources].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.file.localeCompare(b.file) || a.title.localeCompare(b.title),
  )
}

function resolveUnit(
  entry: Entry,
  records: ParsedRecord[],
  report: MatchReport,
): MatchedUnit | null {
  const products = records.filter((r) => r.kind === 'product')
  const amendments = records.filter((r) => r.kind === 'amendment')
  const roles = new Map<ParsedRecord, 'primary' | 'cabinet'>()
  const warnings: string[] = []
  const slug = entry.product.slug

  for (const rec of products) {
    const role = roleOf(rec, entry)
    roles.set(rec, role)
    if (role === 'primary' && rec.volume && entry.product.volume && !sameVolume(rec.volume, entry.product.volume)) {
      warnings.push(`${rec.file}: объём в файле «${volumeLabel(rec.volume)}», на сайте «${volumeLabel(entry.product.volume)}» — записано как основная`)
    }
  }

  const primaries = products.filter((r) => roles.get(r) === 'primary')
  let cabinets = products.filter((r) => roles.get(r) === 'cabinet')
  let promoted = false

  if (primaries.length > 1) {
    report.problems.push(`${slug}: две основные записи (${primaries.map((r) => r.file).join(', ')})`)
    return null
  }
  let main = primaries[0] as ParsedRecord | undefined
  if (!main) {
    if (products.length === 0) {
      report.problems.push(`${slug}: есть только дополнение, основной записи нет`)
      return null
    }
    if (cabinets.length !== 1) {
      report.problems.push(`${slug}: нет основной записи, кабинетных записей ${cabinets.length}`)
      return null
    }
    main = cabinets[0]
    cabinets = []
    promoted = true
    roles.set(main, 'primary')
    warnings.push(`основной записи нет: кабинетная фасовка «${main.volume ? volumeLabel(main.volume) : ''}» стала основной, её применение — в pro.usage`)
  }
  if (!main.details) {
    report.problems.push(`${slug}: карточка основной записи не проходит схему (${main.file})`)
    return null
  }

  let details: ProductDetails = main.details
  if (promoted) {
    details = {
      ...details,
      usage: null,
      pro: {
        volumeLabel: main.volume ? volumeLabel(main.volume) : '',
        tagline: [],
        intro: [],
        howItWorks: null,
        forWhom: null,
        actives: [],
        usage: main.details.usage,
      },
    }
  } else if (cabinets.length > 1) {
    report.problems.push(`${slug}: кабинетных записей больше одной (${cabinets.map((r) => r.file).join(', ')})`)
    return null
  } else if (cabinets.length === 1) {
    const cabinet = cabinets[0]
    if (!cabinet.details) {
      warnings.push(`${cabinet.file}: кабинетная карточка не проходит схему — не сохранена`)
    } else {
      details = { ...details, pro: diffPro(cabinet, main.details) }
      if (cabinet.details.lifehack || cabinet.details.extra.length > 0) {
        warnings.push(`${cabinet.file}: лайфхак и дополнительные блоки кабинетной записи не входят в pro-схему — не сохранены`)
      }
    }
  }

  for (const amendment of amendments) {
    if (!details.usage) {
      warnings.push(`${amendment.file}: дополнение некуда положить — у товара нет способа применения`)
      continue
    }
    details = {
      ...details,
      usage: { ...details.usage, notes: clampNotes([...details.usage.notes, ...amendment.amendmentNotes]) },
    }
    report.rules.push(`${amendment.file}: дополнение «${amendment.title}» → usage.notes товара ${slug}`)
  }

  const check = ProductDetailsSchema.safeParse(details)
  if (!check.success) {
    report.problems.push(`${slug}: итоговая карточка не проходит схему: ${check.error.issues[0]?.message ?? 'ошибка'}`)
    return null
  }

  const sources = sortSources([
    ...products.map((r) => sourceOf(r, roles.get(r) ?? 'primary')),
    ...amendments.map((r) => sourceOf(r, 'amendment')),
  ])
  const recordWarnings = records.flatMap((r) => r.warnings.map((w) => `${r.file}: ${w}`))
  return { slug, sources, warnings: [...recordWarnings, ...warnings], details: check.data }
}

export function matchAll(
  parsed: ParsedRecord[],
  site: SiteProduct[],
  variants: CabinetVariant[],
): MatchReport {
  const report: MatchReport = { matched: [], pending: [], problems: [], noText: [], warnings: [], rules: [] }
  const entries = buildEntries(site, variants, report)
  const bySlug = new Map<string, ParsedRecord[]>()
  const pendingGroups = new Map<string, ParsedRecord[]>()

  for (const rec of parsed) {
    const alias = ALIASES[rec.key]
    if (alias) {
      const target = entries.find((e) => e.product.slug === alias)
      if (!target) {
        report.problems.push(`алиас «${rec.name}» указывает на несуществующий товар ${alias}`)
        continue
      }
      report.rules.push(`${rec.file}: «${rec.name}» → ${alias} (алиас)`)
      bySlug.set(alias, [...(bySlug.get(alias) ?? []), rec])
      continue
    }
    const { exact, prefix } = findEntries(entries, rec.brand, rec.key, nameWords(rec.name))
    if (exact.length > 1 || prefix.length > 1) {
      report.problems.push(`неоднозначно: «${rec.name}» (${rec.file}) → ${[...exact, ...prefix].map((e) => e.product.slug).join(', ')}`)
      continue
    }
    const target = exact[0] ?? prefix[0]
    if (target) {
      if (!exact[0]) report.warnings.push(`«${rec.name}» (${rec.file}) сопоставлен по префиксу с ${target.product.slug}`)
      bySlug.set(target.product.slug, [...(bySlug.get(target.product.slug) ?? []), rec])
      continue
    }
    const groupKey = `${brandKey(rec.brand)}|${rec.key}`
    pendingGroups.set(groupKey, [...(pendingGroups.get(groupKey) ?? []), rec])
  }

  const withRecords = new Set<string>()
  for (const entry of entries) {
    const records = bySlug.get(entry.product.slug)
    if (!records) continue
    withRecords.add(entry.product.slug)
    const unit = resolveUnit(entry, records, report)
    if (unit) report.matched.push(unit)
  }
  for (const entry of entries) {
    if (!withRecords.has(entry.product.slug)) report.noText.push(entry.product.slug)
  }

  for (const [groupKey, records] of [...pendingGroups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const products = records.filter((r) => r.kind === 'product')
    const product = products[0] as ParsedRecord | undefined
    if (products.length !== 1 || !product?.details) {
      report.problems.push(`нет на сайте и не сводится к одной карточке: ${groupKey} (записей ${records.length})`)
      continue
    }
    report.pending.push({
      key: records[0].key,
      brand: product.brand,
      sources: [sourceOf(product, 'primary')],
      warnings: product.warnings.map((w) => `${product.file}: ${w}`),
      details: product.details,
    })
  }

  report.matched.sort((a, b) => a.slug.localeCompare(b.slug))
  report.pending.sort((a, b) => a.key.localeCompare(b.key))
  report.noText.sort()
  return report
}
