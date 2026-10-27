import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const ASSETS = fileURLToPath(new URL('../../assets', import.meta.url))
const SNAPSHOT = fileURLToPath(new URL('../../../client/public/snapshot/catalog.json', import.meta.url))
const INCI_FILE = fileURLToPath(new URL('../../../../../docs/projects/perfect-skin/content/inci/isseimi.json', import.meta.url))

// Проверяются товары с официальным INCI (сверка 27.10.2026). Без INCI (Q1–Q3: GLACÉE, BEEVENOM, 11 товаров) состава нет, в проверку не входят
const FORBIDDEN: Array<[RegExp, string]> = [
  [/стволов/i, 'стволовые клетки'],
  [/(?<!био)целлюлоз/i, 'целлюлоза'],
  [/винн(ая|ой) кислот/i, 'винная кислота'],
  [/клюкв/i, 'клюква'],
  [/глицин сои/i, 'глицин сои'],
  [/пироглутамин/i, 'пироглутаминовая кислота'],
  [/pronalen|пронален/i, 'Pronalen'],
  [/инкапсулир/i, 'инкапсулированный озон'],
  [/ш[её]лк/i, 'гидролизат шелка'],
  [/фибронектин/i, 'фибронектин'],
  [/розмарин/i, 'розмарин'],
  [/масло шалфея|гидролизат лаванды|масло чиа|дикий шиповник|экстракт шиповника/i, 'состав до сверки'],
  [/экстракт пшеничных протеинов|экстракт пшеницы|озонированное масло баобаба|экстракт алоэ вера|масло лаванды/i, 'состав до сверки'],
  [/разноуровнев|воски пчелиный|наличию мимических|свежеести|и0 нанесите/i, 'опечатка до сверки'],
]

// Названия состава, которые сверка убрала (таблица, раздел 12). Только для состава, не для текстов карточек: «Гидролат лаванды» в actives 3 FLOWER сверкой оставлен.
// Без slug — у всех товаров с INCI, со slug — у одного. «Гидролат лаванды» у CHIA DETOX и «Гидролат цветков апельсина» у NATURAL CLEANSING MILK оставлены, поэтому правило точечное
interface OldName {
  pattern: RegExp
  label: string
  slug?: string
}

const OLD_INGREDIENTS: OldName[] = [
  { pattern: /^EGF$/, label: 'EGF (в INCI TTS ESSENTIAL его нет)', slug: 'tts-essential-mask-ukreplyayushhaya-i-obnovlyayushhaya-maska' },
  { pattern: /^Экстракт лаванды$/i, label: 'экстракт лаванды' },
  { pattern: /^Гидролат (цветков апельсина|лаванды|гамамелиса)$/i, label: 'гидролат', slug: '3-flower-serum-multi-uvlazhnyayushhaya-syvorotka' },
]

// Остаётся по решению сверки: у O3 DEPUR есть фосфолипидный носитель в INCI (вопрос владельцу, см. отчёт)
const ALLOWED: Record<string, RegExp> = { 'o3-depur-krem-s-ozonom': /инкапсулир/i }

interface Scope {
  slug: string
  source: string
  text: string
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'))
}

const inciSlugs = new Set(
  (readJson(INCI_FILE) as { items: Array<{ slug: string }> }).items.map((item) => item.slug),
)

function cardScope(): Scope[] {
  const dir = `${ASSETS}/product-details`
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json') && !name.startsWith('_'))
    .map((name) => readJson(`${dir}/${name}`) as { slug: string; details: unknown })
    .filter((file) => inciSlugs.has(file.slug))
    .flatMap((file) => strings(file.details).map((text) => ({ slug: file.slug, source: `карточка ${file.slug}`, text })))
}

function catalogScope(): Scope[] {
  const catalog = readJson(`${ASSETS}/catalog-curated.json`) as {
    products: Array<{ slug: string; name: string; action: string | null; application: string | null; ingredients: string[] }>
  }
  return catalog.products
    .filter((product) => inciSlugs.has(product.slug))
    .flatMap((product) =>
      strings([product.name, product.action, product.application, product.ingredients]).map((text) => ({
        slug: product.slug,
        source: `каталог ${product.slug}`,
        text,
      })),
    )
}

function snapshotScope(): Scope[] {
  const snapshot = readJson(SNAPSHOT) as {
    products: Array<{ detail: { slug: string; name: string; shortDescription: string | null; description: string; usage: string | null; details: unknown } }>
  }
  return snapshot.products
    .map((product) => product.detail)
    .filter((detail) => inciSlugs.has(detail.slug))
    .flatMap((detail) =>
      strings([detail.name, detail.shortDescription, detail.description, detail.usage, detail.details]).map((text) => ({
        slug: detail.slug,
        source: `снимок ${detail.slug}`,
        text,
      })),
    )
}

function catalogIngredients(): Record<string, string[]> {
  const catalog = readJson(`${ASSETS}/catalog-curated.json`) as { products: Array<{ slug: string; ingredients: string[] }> }
  return Object.fromEntries(
    catalog.products
      .filter((product) => inciSlugs.has(product.slug))
      .map((product): [string, string[]] => [product.slug, product.ingredients]),
  )
}

function snapshotIngredients(): Record<string, string[]> {
  const snapshot = readJson(SNAPSHOT) as {
    products: Array<{ detail: { slug: string; ingredients: Array<{ name: string }> } }>
  }
  return Object.fromEntries(
    snapshot.products
      .filter((product) => inciSlugs.has(product.detail.slug))
      .map((product): [string, string[]] => [product.detail.slug, product.detail.ingredients.map((item) => item.name)]),
  )
}

function violationsOf(scope: Scope[], oldNames: OldName[] = []): string[] {
  return scope.flatMap(({ slug, source, text }) => {
    if (ALLOWED[slug]?.test(text)) return []
    const labels = [
      ...FORBIDDEN.filter(([pattern]) => pattern.test(text)).map(([, label]) => label),
      ...oldNames
        .filter((rule) => rule.pattern.test(text) && (!rule.slug || rule.slug === slug))
        .map((rule) => rule.label),
    ]
    return labels.map((label) => `${source}: ${label} — «${text.slice(0, 80)}»`)
  })
}

describe('ISSEIMI с INCI: собранные данные не содержат формулировок вне официального состава', () => {
  const scopes = {
    карточки: cardScope(),
    каталог: catalogScope(),
    снимок: snapshotScope(),
  }

  it('проверка охватывает все 20 товаров сверки в каждом источнике', () => {
    expect(new Set(scopes.карточки.map((item) => item.slug))).toEqual(inciSlugs)
    expect(new Set(scopes.каталог.map((item) => item.slug)).size).toBeGreaterThanOrEqual(15)
    expect(new Set(scopes.снимок.map((item) => item.slug)).size).toBeGreaterThanOrEqual(15)
  })

  it.each(Object.entries(scopes))('в данных (%s) нет запрещённых формулировок', (_, scope) => {
    expect(violationsOf(scope)).toEqual([])
  })
})

describe('ISSEIMI с INCI: состав в снимке совпадает с catalog-curated и без старых названий', () => {
  const catalog = catalogIngredients()
  const snapshot = snapshotIngredients()

  it('снимок содержит тот же состав, что catalog-curated, у всех товаров с INCI', () => {
    expect(Object.keys(snapshot)).toHaveLength(Object.keys(catalog).length)
    expect(snapshot).toEqual(catalog)
  })

  it('в составе каталога и снимка нет названий, которые сверка убрала', () => {
    const scope: Scope[] = Object.entries({ каталог: catalog, снимок: snapshot }).flatMap(([source, items]) =>
      Object.entries(items).flatMap(([slug, names]) => names.map((text) => ({ slug, source: `${source} ${slug}`, text }))),
    )
    expect(violationsOf(scope, OLD_INGREDIENTS)).toEqual([])
  })
})
