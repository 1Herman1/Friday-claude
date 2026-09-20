import { db, type Prisma } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'

export interface ListPostsOptions {
  published?: boolean
  isActive?: boolean
  limit: number
  offset: number
}

export interface CreatePostPayload {
  title: string
  slug: string
  body: string
  excerpt?: string | null
  coverImage?: string | null
  audience: 'public' | 'retail'
  seoTitle?: string | null
  seoDescription?: string | null
  publishedAt?: Date | null
}

export interface UpdatePostPayload {
  title?: string
  slug?: string
  body?: string
  excerpt?: string | null
  coverImage?: string | null
  audience?: 'public' | 'retail'
  seoTitle?: string | null
  seoDescription?: string | null
  publishedAt?: Date | null
  isActive?: boolean
}

export interface ProductCard {
  id: string
  slug: string
  name: string
  brand: { id: string; name: string; slug: string } | null
  image: string | null
  minPrice: number | null
}

export class PostService {
  /**
   * List posts with optional filters. For admin: all posts including drafts.
   */
  async listPosts(options: ListPostsOptions) {
    const where: Prisma.PostWhereInput = {
      isActive: options.isActive !== false ? true : undefined,
    }

    // If published filter is set, check publishedAt
    if (options.published === true) {
      where.publishedAt = { not: null }
    } else if (options.published === false) {
      where.publishedAt = null
    }

    const [items, total] = await Promise.all([
      db.post.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        take: options.limit,
        skip: options.offset,
      }),
      db.post.count({ where }),
    ])

    return { items, total, limit: options.limit, offset: options.offset }
  }

  /**
   * Get post by slug. For public API: only published posts.
   */
  async getPostBySlug(slug: string, publishedOnly: boolean = false) {
    const where: Prisma.PostWhereInput = { slug }

    if (publishedOnly) {
      where.isActive = true
      where.publishedAt = { not: null }
    }

    const post = await db.post.findFirst({ where })

    if (!post) {
      throw new ApiError(404, 'NOT_FOUND', 'Статья не найдена')
    }

    return post
  }

  /**
   * Extract product slugs from markdown content [[product:slug]].
   */
  extractProductSlugs(content: string): string[] {
    const regex = /\[\[product:([a-z0-9-]+)\]\]/g
    const slugs = new Set<string>()
    let match

    while ((match = regex.exec(content)) !== null) {
      slugs.add(match[1])
    }

    return Array.from(slugs)
  }

  /**
   * Get products by slugs. Used to embed in post response.
   */
  async getProductsBySlug(slugs: string[]): Promise<ProductCard[]> {
    if (slugs.length === 0) return []

    const products = await db.product.findMany({
      where: { slug: { in: slugs }, isActive: true },
      select: {
        id: true,
        slug: true,
        name: true,
        images: true,
        minPrice: true,
        isProfessional: true,
        brand: {
          select: { id: true, name: true, slug: true },
        },
      },
    })

    return products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      image: p.images?.[0] || null,
      minPrice: p.isProfessional ? null : p.minPrice,
    }))
  }

  /**
   * Create new post.
   */
  async createPost(payload: CreatePostPayload) {
    // Check slug uniqueness
    const existing = await db.post.findFirst({ where: { slug: payload.slug } })
    if (existing) {
      throw new ApiError(409, 'SLUG_EXISTS', 'Слаг уже занят')
    }

    const post = await db.post.create({
      data: {
        title: payload.title,
        slug: payload.slug,
        body: payload.body,
        excerpt: payload.excerpt || null,
        coverImage: payload.coverImage || null,
        audience: payload.audience,
        seoTitle: payload.seoTitle || null,
        seoDescription: payload.seoDescription || null,
        publishedAt: payload.publishedAt || null,
        isActive: true,
      },
    })

    return post
  }

  /**
   * Update post by id.
   */
  async updatePost(id: string, payload: UpdatePostPayload) {
    const post = await db.post.findUnique({ where: { id } })
    if (!post) {
      throw new ApiError(404, 'NOT_FOUND', 'Статья не найдена')
    }

    // Check slug uniqueness if changing
    if (payload.slug && payload.slug !== post.slug) {
      const existing = await db.post.findFirst({ where: { slug: payload.slug } })
      if (existing) {
        throw new ApiError(409, 'SLUG_EXISTS', 'Слаг уже занят')
      }
    }

    return db.post.update({
      where: { id },
      data: {
        ...(payload.title !== undefined && { title: payload.title }),
        ...(payload.slug !== undefined && { slug: payload.slug }),
        ...(payload.body !== undefined && { body: payload.body }),
        ...(payload.excerpt !== undefined && { excerpt: payload.excerpt }),
        ...(payload.coverImage !== undefined && { coverImage: payload.coverImage }),
        ...(payload.audience !== undefined && { audience: payload.audience }),
        ...(payload.seoTitle !== undefined && { seoTitle: payload.seoTitle }),
        ...(payload.seoDescription !== undefined && { seoDescription: payload.seoDescription }),
        ...(payload.publishedAt !== undefined && { publishedAt: payload.publishedAt }),
        ...(payload.isActive !== undefined && { isActive: payload.isActive }),
      },
    })
  }

  /**
   * Delete post by id (soft delete via isActive flag).
   */
  async deletePost(id: string) {
    const post = await db.post.findUnique({ where: { id } })
    if (!post) {
      throw new ApiError(404, 'NOT_FOUND', 'Статья не найдена')
    }

    return db.post.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    })
  }
}

export const postService = new PostService()
