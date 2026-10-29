import { CONTACTS, SITE_NAME } from '@ps/shared'
import type { PostKind } from '@ps/shared'

type JsonLd = Record<string, unknown>

const CONTEXT = 'https://schema.org'

export function organizationJsonLd(base: string): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'Organization',
    name: SITE_NAME,
    url: `${base}/`,
    telephone: '+7-495-183-28-48',
    email: CONTACTS.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: CONTACTS.street,
      addressLocality: CONTACTS.city,
      addressCountry: 'RU',
    },
  }
}

export function breadcrumbJsonLd(base: string, items: { name: string; path: string }[]): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${base}${item.path}`,
    })),
  }
}

export interface ProductJsonLdInput {
  name: string
  description: string
  url: string
  imageUrl: string | null
  brandName: string | null
  lowPriceKop: number | null
  highPriceKop: number | null
  offerCount: number
  inStock: boolean
}

export function productJsonLd(input: ProductJsonLdInput): JsonLd {
  const offers =
    input.lowPriceKop !== null
      ? {
          '@type': 'AggregateOffer',
          priceCurrency: 'RUB',
          lowPrice: input.lowPriceKop / 100,
          highPrice: (input.highPriceKop ?? input.lowPriceKop) / 100,
          offerCount: input.offerCount,
          availability: input.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: input.url,
        }
      : undefined

  return {
    '@context': CONTEXT,
    '@type': 'Product',
    name: input.name,
    description: input.description,
    url: input.url,
    ...(input.imageUrl && { image: input.imageUrl }),
    ...(input.brandName && { brand: { '@type': 'Brand', name: input.brandName } }),
    ...(offers && { offers }),
  }
}

export interface PostJsonLdInput {
  kind: PostKind
  headline: string
  description: string
  url: string
  imageUrl: string | null
  publishedAt: Date
  updatedAt: Date
}

export function postJsonLd(input: PostJsonLdInput): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': input.kind === 'news' ? 'NewsArticle' : 'BlogPosting',
    headline: input.headline,
    description: input.description,
    mainEntityOfPage: input.url,
    url: input.url,
    datePublished: input.publishedAt.toISOString(),
    dateModified: input.updatedAt.toISOString(),
    ...(input.imageUrl && { image: input.imageUrl }),
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME },
  }
}
