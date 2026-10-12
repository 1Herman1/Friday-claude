import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { matchProduct } from '../lib/import-prices.match.js'
import { parseRetailProductsFile } from '../lib/import-retail-products.plan.js'

const assets = new URL('../../assets/', import.meta.url)

const priceFile: {
  items: Array<{ article: number; name: string; volume: string; siteName?: string; forceSingleVariant?: boolean }>
} = JSON.parse(readFileSync(new URL('price-import.json', assets), 'utf-8'))

const retail = parseRetailProductsFile(JSON.parse(readFileSync(new URL('retail-products.json', assets), 'utf-8')))

const products = retail.products.map((p) => ({
  id: p.slug,
  name: p.name,
  variants: [{ id: `${p.slug}-variant`, volumeValue: p.volume, volumeUnit: 'ml' as const, isActive: true, deletedAt: null }],
}))

function priceItemFor(article: number) {
  const item = priceFile.items.find((i) => i.article === article)
  if (!item) throw new Error(`В прайсе нет артикула ${article}`)
  return item
}

describe('сопоставление прайса с новыми розничными товарами', () => {
  it.each([
    [10129, 'cleansing-balm-ochishhayushhij-balzam'],
    [10130, 'cbd-night-mask-nochnaya-vosstanavlivayushhaya-maska'],
  ])('артикул %i сопоставляется с %s по siteName', (article, slug) => {
    const result = matchProduct(priceItemFor(article), products)
    expect(result).toMatchObject({ kind: 'match', productId: slug })
  })

  it('все 8 артикулов сопоставляются со своим товаром', () => {
    for (const p of retail.products) {
      const result = matchProduct(priceItemFor(p.article), products)
      expect(result, p.slug).toMatchObject({ kind: 'match', productId: p.slug })
    }
  })
})
