const PRODUCT_LINK = /\[\[product:([a-z0-9-]+)\]\]/g

export function extractProductSlugs(content: string): string[] {
  return [...new Set([...content.matchAll(PRODUCT_LINK)].map((match) => match[1]))]
}
