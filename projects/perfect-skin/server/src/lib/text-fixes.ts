// Таблица исправлений текста клиента: опечатки, знаки, смешанные алфавиты.
// Работает с одной строкой; каждая правка попадает в fixes, повторный прогон ничего не меняет.

const CYR_TO_LAT: Record<string, string> = {
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X', У: 'Y',
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x',
}
const LAT_TO_CYR: Record<string, string> = Object.fromEntries(Object.entries(CYR_TO_LAT).map(([cyr, lat]) => [lat, cyr]))

const WORD_RE = /[\p{L}\p{N}]+/gu
const CYRILLIC_RE = /\p{Script=Cyrillic}/u
const LATIN_RE = /\p{Script=Latin}/u

// «привести в соответствие с» — верно, правим только «в соответствие с» в значении «согласно»
const TYPOS: Array<[RegExp, string]> = [
  [/(?<!\p{L})элексир/giu, 'эликсир'],
  [/(?<!\p{L})витамие(?!\p{L})/giu, 'витамин'],
  [/(?<!\p{L})антивозрасн/giu, 'антивозрастн'],
  [/(?<!\p{L}|(?:прив[ео]|прий|приход|приш)\p{L}*\s+)в\s+соответствие\s+с(?!\p{L})/giu, 'в соответствии с'],
  [/(?<!\p{L})обь(?=[её]м)/giu, 'объ'],
]

type Context = 'word' | 'phrase'

const CONTEXT: Record<Context, { left: RegExp; right: RegExp }> = {
  word: { left: /[\p{L}\p{N}]*$/u, right: /^[\p{L}\p{N}]*/u },
  phrase: { left: /\S*$/u, right: /^\S*/u },
}
const CONTEXT_MAX = 30

function fixWord(word: string): string {
  if (!CYRILLIC_RE.test(word) || !LATIN_RE.test(word)) return word
  let cyrillic = false
  let latin = false
  for (const ch of word) {
    if (CYR_TO_LAT[ch] !== undefined || LAT_TO_CYR[ch] !== undefined) continue
    if (CYRILLIC_RE.test(ch)) cyrillic = true
    else if (LATIN_RE.test(ch)) latin = true
  }
  if (cyrillic === latin) return word
  const table = cyrillic ? LAT_TO_CYR : CYR_TO_LAT
  return [...word].map((ch) => table[ch] ?? ch).join('')
}

export function fixMixedScript(text: string): string {
  return text.replace(WORD_RE, fixWord)
}

function withCase(sample: string, word: string): string {
  if (sample === sample.toUpperCase() && sample !== sample.toLowerCase()) return word.toUpperCase()
  const first = sample[0] ?? ''
  if (first !== first.toLowerCase()) return word[0].toUpperCase() + word.slice(1)
  return word
}

function quote(left: string, middle: string, right: string): string {
  return `«${left}${middle}${right}»`
}

function replaceTracked(text: string, re: RegExp, to: (match: string) => string, context: Context, fixes: string[]): string {
  const { left: leftRe, right: rightRe } = CONTEXT[context]
  let out = ''
  let last = 0
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0
    const end = start + m[0].length
    const next = to(m[0])
    if (next === m[0]) continue
    const left = (leftRe.exec(text.slice(0, start))?.[0] ?? '').slice(-CONTEXT_MAX)
    const right = (rightRe.exec(text.slice(end))?.[0] ?? '').slice(0, CONTEXT_MAX)
    fixes.push(`${quote(left, m[0], right)} → ${quote(left, next, right)}`)
    out += text.slice(last, start) + next
    last = end
  }
  return out + text.slice(last)
}

// Хвост из «…» и точек: 2+ «…» или 4+ точек убираются; точка сразу после слова остаётся концом фразы
function stripTail(text: string, fixes: string[]): string {
  const tail = /[.…\s]+$/u.exec(text)
  if (!tail) return text
  const head = text.slice(0, tail.index)
  const dots = tail[0].split('.').length - 1
  const ellipses = tail[0].split('…').length - 1
  if (head && ellipses < 2 && dots < 4) return text
  const kept = head && tail[0].startsWith('.') && !/[!?]$/.test(head) ? `${head}.` : head
  if (kept === text) return text
  const left = (CONTEXT.phrase.left.exec(head)?.[0] ?? '').slice(-CONTEXT_MAX)
  fixes.push(`${quote(left, tail[0], '')} → ${quote(left, kept.slice(head.length), '')}`)
  return kept
}

function fixPass(text: string, fixes: string[]): string {
  let out = replaceTracked(text, /(?<=\p{L})[^\S\n]+\.(?=\d)/gu, () => ' ', 'phrase', fixes)
  out = replaceTracked(out, /[^\S\n]+(?=[,;:!?]|\.(?![.…\d]))/gu, () => '', 'phrase', fixes)
  out = replaceTracked(out, /^(?:[.,;:]+[^\S\n]*)+/gu, () => '', 'phrase', fixes)
  out = replaceTracked(out, /(?<=\p{Ll})[.!?](?=\p{Lu}\p{Ll})/gu, (m) => `${m} `, 'phrase', fixes)
  out = stripTail(out, fixes)
  for (const [re, word] of TYPOS) {
    out = replaceTracked(out, re, (m) => withCase(m, word), 'word', fixes)
  }
  out = replaceTracked(out, WORD_RE, fixWord, 'word', fixes)
  return out.replace(/[^\S\n]{2,}/g, ' ').trim()
}

// Проходы до неподвижной точки: правка алфавита может открыть опечатку («Oбьем» → «Обьем» → «Объем»)
const MAX_PASSES = 3

export function fixClientText(text: string): { text: string; fixes: string[] } {
  const fixes: string[] = []
  let out = text.trim()
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const before = fixes.length
    out = fixPass(out, fixes)
    if (fixes.length === before) break
  }
  return { text: out, fixes }
}
