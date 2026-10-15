// Старые адреса товаров → новые: ссылки из закладок, поиска и избранного продолжают работать
export const SLUG_ALIASES: Record<string, string> = {
  'veevenom-serum-syvorotka-pchelinyj-yad': 'beevenom-serum-syvorotka-pchelinyj-yad',
}

// hasOwn — чтобы slug вроде «constructor» не попал в прототип объекта
export function resolveSlugAlias(slug: string): string | undefined {
  return Object.hasOwn(SLUG_ALIASES, slug) ? SLUG_ALIASES[slug] : undefined
}
