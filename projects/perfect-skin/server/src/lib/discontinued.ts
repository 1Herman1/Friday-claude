import { readFileSync } from 'node:fs'
import { parseDiscontinuedFile } from './discontinue.plan.js'

// Решение владельца «сняты с продажи навсегда»: такие адреса отдают 410 и не попадают в sitemap, даже если в БД товар ещё активен.
export const DISCONTINUED_SLUGS: ReadonlySet<string> = new Set(
  parseDiscontinuedFile(JSON.parse(readFileSync(new URL('../../assets/discontinued.json', import.meta.url), 'utf8'))).products,
)
