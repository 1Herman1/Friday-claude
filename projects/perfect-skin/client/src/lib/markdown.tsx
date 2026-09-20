import React from 'react'
import { PriceTag } from '@/components/product/PriceTag'

export interface ProductCard {
  id: string
  slug: string
  name: string
  image: string | null
  minPrice: number | null
  oldPrice?: number | null
  priceHidden?: boolean
  brand: { id: string; name: string; slug: string } | null
}

function ProductEmbed({ product }: { product: ProductCard }) {
  return (
    <div className="my-8 p-6 border border-border rounded-block bg-card">
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Product image: full width on mobile, fixed width on larger screens */}
        {product.image && (
          <picture className="w-full sm:w-32 flex-shrink-0">
            <source
              srcSet={`/products-optimized/${product.slug}/card.webp 1x, /products-optimized/${product.slug}/card@2x.webp 2x`}
              type="image/webp"
            />
            <img
              src={product.image}
              alt={product.name}
              onError={(e) => {
                // Fallback to product.image if optimized version fails
                e.currentTarget.src = product.image!
              }}
              className="w-full sm:w-32 h-40 sm:h-40 object-cover rounded-block"
            />
          </picture>
        )}
        <div className="flex-1">
          {product.brand && (
            <p className="text-label font-sans uppercase text-muted-foreground mb-2">
              {product.brand.name}
            </p>
          )}
          <h3 className="text-body font-heading font-semibold mb-4 text-foreground">
            {product.name}
          </h3>
          <p className="text-h4 font-heading font-bold text-primary mb-4">
            <PriceTag
              price={product.minPrice}
              oldPrice={product.oldPrice}
              hidden={product.priceHidden}
              size="lg"
            />
          </p>
          <a
            href={`/product/${product.slug}`}
            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-block hover:bg-primary/90 transition-colors font-sans text-sm font-medium"
          >
            Подробнее
          </a>
        </div>
      </div>
    </div>
  )
}

interface MarkdownRendererOptions {
  products?: ProductCard[]
}

export function renderMarkdown(content: string, options: MarkdownRendererOptions = {}): React.ReactNode[] {
  const products = options.products || []
  const productMap = new Map(products.map((p) => [p.slug, p]))

  const elements: React.ReactNode[] = []
  let key = 0

  // Split by double newlines to get paragraphs
  const paragraphs = content.split(/\n\n+/)

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue

    // Check if it's a product embed
    const productMatch = paragraph.match(/^\[\[product:([a-z0-9-]+)\]\]$/)
    if (productMatch) {
      const slug = productMatch[1]
      const product = productMap.get(slug)
      if (product) {
        elements.push(<ProductEmbed key={`product-${slug}`} product={product} />)
      } else {
        // Fallback: just show a link if product data is missing
        elements.push(
          <p key={`fallback-${key++}`} className="text-body text-muted-foreground mb-4">
            <a href={`/catalog?q=${slug}`} className="text-primary hover:underline">
              {slug}
            </a>
          </p>
        )
      }
      continue
    }

    // Check if it's a heading
    if (paragraph.startsWith('##')) {
      const match = paragraph.match(/^(#{2,3})\s+(.+)$/)
      if (match) {
        const level = match[1].length
        const text = match[2]
        const className = level === 2 ? 'text-h3 font-heading font-bold mb-4 mt-6' : 'text-h4 font-heading font-semibold mb-3 mt-4'
        elements.push(
          <h2 key={`heading-${key++}`} className={`${className} text-foreground`}>
            {renderInlineMarkdown(text)}
          </h2>
        )
        continue
      }
    }

    // Check if it's a list
    if (paragraph.startsWith('-')) {
      const listItems = paragraph.split('\n').filter((line) => line.trim().startsWith('-'))
      elements.push(
        <ul key={`list-${key++}`} className="list-disc list-inside mb-4 space-y-1">
          {listItems.map((item, idx) => (
            <li key={`list-item-${idx}`} className="text-body text-foreground">
              {renderInlineMarkdown(item.replace(/^-\s*/, ''))}
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Regular paragraph
    elements.push(
      <p key={`paragraph-${key++}`} className="text-body text-foreground mb-4 leading-body">
        {renderInlineMarkdown(paragraph)}
      </p>
    )
  }

  return elements
}

function renderInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let lastIndex = 0

  // Match bold **text**
  const boldRegex = /\*\*([^\*]+)\*\*/g
  let boldMatch

  // Match italic *text*
  const italicRegex = /\*([^\*]+)\*/g
  let italicMatch

  // Match links [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^\)]+)\)/g
  let linkMatch

  // Create a sorted array of all matches with their positions
  const allMatches: Array<{
    start: number
    end: number
    type: 'bold' | 'italic' | 'link'
    content: string | [string, string]
  }> = []

  // Find all matches
  while ((boldMatch = boldRegex.exec(text))) {
    allMatches.push({
      start: boldMatch.index,
      end: boldMatch.index + boldMatch[0].length,
      type: 'bold',
      content: boldMatch[1],
    })
  }

  while ((italicMatch = italicRegex.exec(text))) {
    // Skip if inside bold
    const isBold = allMatches.some((m) => m.type === 'bold' && m.start < italicMatch!.index && italicMatch!.index < m.end)
    if (!isBold) {
      allMatches.push({
        start: italicMatch.index,
        end: italicMatch.index + italicMatch[0].length,
        type: 'italic',
        content: italicMatch[1],
      })
    }
  }

  while ((linkMatch = linkRegex.exec(text))) {
    allMatches.push({
      start: linkMatch.index,
      end: linkMatch.index + linkMatch[0].length,
      type: 'link',
      content: [linkMatch[1], linkMatch[2]],
    })
  }

  // Sort by start position
  allMatches.sort((a, b) => a.start - b.start)

  // Remove overlapping matches (keep the first)
  const filtered: typeof allMatches = []
  for (const match of allMatches) {
    const overlaps = filtered.some((m) => !(match.end <= m.start || match.start >= m.end))
    if (!overlaps) {
      filtered.push(match)
    }
  }

  // Build parts
  for (const match of filtered) {
    if (lastIndex < match.start) {
      parts.push(text.substring(lastIndex, match.start))
    }

    if (match.type === 'bold') {
      parts.push(
        <strong key={`bold-${match.start}`} className="font-semibold">
          {match.content}
        </strong>
      )
    } else if (match.type === 'italic') {
      parts.push(
        <em key={`italic-${match.start}`} className="italic">
          {match.content}
        </em>
      )
    } else if (match.type === 'link' && Array.isArray(match.content)) {
      const [linkText, href] = match.content

      // Validate href: only allow http(s), mailto, and relative URLs
      const isValidHref =
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('mailto:') ||
        href.startsWith('/') ||
        href.startsWith('#') ||
        !href.includes(':') // relative URL like "page" or "page/section"

      if (isValidHref) {
        parts.push(
          <a
            key={`link-${match.start}`}
            href={href}
            className="text-primary hover:underline"
            target={href.startsWith('http') ? '_blank' : undefined}
            rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            {linkText}
          </a>
        )
      } else {
        // Invalid URL scheme (e.g., javascript:) — render as plain text
        parts.push(linkText)
      }
    }

    lastIndex = match.end
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts.length === 0 ? text : parts
}
