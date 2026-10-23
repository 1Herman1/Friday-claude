import { db, type Prisma, type PostKind } from '../lib/db.js'
import { type PriceViewer } from '../lib/pricing.js'
import { ACTIVE, productVisibleFor } from '../lib/prisma-filters.js'
import { ApiError } from '../lib/errors.js'

export interface ListPostsOptions {
  publicOnly?: boolean
  published?: boolean
  kind?: PostKind
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
  kind: PostKind
  isAd: boolean
  advertiser?: string | null
  erid?: string | null
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
  kind?: PostKind
  isAd?: boolean
  advertiser?: string | null
  erid?: string | null
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

const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImage: true,
  kind: true,
  isAd: true,
  advertiser: true,
  erid: true,
  isActive: true,
  publishedAt: true,
  createdAt: true,
} satisfies Prisma.PostSelect

function publicPostWhere(now: Date): Prisma.PostWhereInput {
  return { deletedAt: null, isActive: true, audience: 'public', publishedAt: { lte: now } }
}

export class PostService {
  async listPosts(options: ListPostsOptions) {
    const publishedAt = options.published === undefined ? undefined : options.published ? { not: null } : null
    const where: Prisma.PostWhereInput = options.publicOnly
      ? { ...publicPostWhere(new Date()), kind: options.kind }
      : { deletedAt: null, isActive: true, kind: options.kind, publishedAt }

    const [items, total] = await Promise.all([
      db.post.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { publishedAt: 'desc' },
        take: options.limit,
        skip: options.offset,
      }),
      db.post.count({ where }),
    ])

    return { items, total, limit: options.limit, offset: options.offset }
  }

  async getPublicPostBySlug(slug: string) {
    const post = await db.post.findFirst({ where: { slug, ...publicPostWhere(new Date()) } })

    if (!post) {
      throw new ApiError(404, 'NOT_FOUND', 'Статья не найдена')
    }

    return post
  }

  /**
   * Товары, на которые ссылается статья. Учитывает, кто читает: профессиональные
   * позиции гостю не отдаются.
   */
  async getProductsBySlug(slugs: string[], viewer: PriceViewer = null): Promise<ProductCard[]> {
    if (slugs.length === 0) return []

    // То же правило видимости, что у каталога; раньше здесь не проверялись
    // фасовки и deletedAt.
    const products = await db.product.findMany({
      where: {
        slug: { in: slugs },
        ...ACTIVE,
        ...productVisibleFor(viewer),
      },
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

  async createPost(payload: CreatePostPayload) {
    const existing = await db.post.findFirst({ where: { slug: payload.slug, deletedAt: null } })
    if (existing) {
      throw new ApiError(409, 'SLUG_EXISTS', 'Слаг уже занят')
    }

    return db.post.create({
      data: {
        title: payload.title,
        slug: payload.slug,
        body: payload.body,
        excerpt: payload.excerpt || null,
        coverImage: payload.coverImage || null,
        audience: payload.audience,
        kind: payload.kind,
        isAd: payload.isAd,
        advertiser: payload.advertiser || null,
        erid: payload.erid || null,
        seoTitle: payload.seoTitle || null,
        seoDescription: payload.seoDescription || null,
        publishedAt: payload.publishedAt || null,
        isActive: true,
      },
    })
  }

  async updatePost(id: string, payload: UpdatePostPayload) {
    const post = await db.post.findFirst({ where: { id, deletedAt: null } })
    if (!post) {
      throw new ApiError(404, 'NOT_FOUND', 'Статья не найдена')
    }

    if (payload.slug && payload.slug !== post.slug) {
      const existing = await db.post.findFirst({ where: { slug: payload.slug, deletedAt: null } })
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
        ...(payload.kind !== undefined && { kind: payload.kind }),
        ...(payload.isAd !== undefined && { isAd: payload.isAd }),
        ...(payload.advertiser !== undefined && { advertiser: payload.advertiser }),
        ...(payload.erid !== undefined && { erid: payload.erid }),
        ...(payload.seoTitle !== undefined && { seoTitle: payload.seoTitle }),
        ...(payload.seoDescription !== undefined && { seoDescription: payload.seoDescription }),
        ...(payload.publishedAt !== undefined && { publishedAt: payload.publishedAt }),
        ...(payload.isActive !== undefined && { isActive: payload.isActive }),
      },
    })
  }

  async deletePost(id: string) {
    const post = await db.post.findFirst({ where: { id, deletedAt: null } })
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
