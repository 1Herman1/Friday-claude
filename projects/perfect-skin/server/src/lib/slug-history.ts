// Массив растёт при каждом переименовании, поэтому держим последние 20 адресов
const MAX_PREVIOUS_SLUGS = 20

export function nextPreviousSlugs(current: string[], oldSlug: string, newSlug: string): string[] {
  if (oldSlug === newSlug) return current
  const kept = current.filter((slug) => slug !== newSlug)
  const withOld = kept.includes(oldSlug) ? kept : [...kept, oldSlug]
  return withOld.slice(-MAX_PREVIOUS_SLUGS)
}
