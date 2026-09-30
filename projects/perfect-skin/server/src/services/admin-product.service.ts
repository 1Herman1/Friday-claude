import { db, type Prisma } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'
import { recalcProductPrices } from './product-prices.js'

interface ListVariantsQuery {
  search?: string
  isActive?: boolean
  lowStock?: boolean
  limit: number
  offset: number
}

interface UpdateVariantPayload {
  stock?: number
  retailPrice?: number
  wholesalePrice?: number | null
  isActive?: boolean
  isProfessional?: boolean
}

export class AdminProductService {
  async listVariants(query: ListVariantsQuery) {
    const where: Prisma.ProductVariantWhereInput = {}

    if (query.isActive !== undefined) {
      where.isActive = query.isActive
    }

    if (query.search) {
      where.OR = [
        {
          product: {
            name: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        },
        {
          sku: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ]
    }

    if (query.lowStock) {
      where.stock = { lte: 10 }
    }

    const [items, total] = await Promise.all([
      db.productVariant.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              brand: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      db.productVariant.count({ where }),
    ])

    return {
      items: items.map((variant) => this.formatVariantResponse(variant)),
      total,
      limit: query.limit,
      offset: query.offset,
    }
  }

  async updateVariant(id: string, payload: UpdateVariantPayload) {
    const variant = await db.productVariant.findUnique({
      where: { id },
      include: { product: { select: { name: true } } },
    })

    if (!variant) {
      throw new ApiError(404, 'VARIANT_NOT_FOUND', 'Фасовка не найдена')
    }

    // Validate payload
    if (payload.stock !== undefined && payload.stock < 0) {
      throw new ApiError(400, 'INVALID_STOCK', 'Остаток не может быть отрицательным')
    }

    if (payload.retailPrice !== undefined && payload.retailPrice <= 0) {
      throw new ApiError(400, 'INVALID_PRICE', 'Цена должна быть больше нуля')
    }

    if (payload.wholesalePrice !== undefined && payload.wholesalePrice !== null && payload.wholesalePrice < 0) {
      throw new ApiError(400, 'INVALID_PRICE', 'Оптовая цена не может быть отрицательной')
    }

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.productVariant.update({
        where: { id },
        data: {
          ...(payload.stock !== undefined && { stock: payload.stock }),
          ...(payload.retailPrice !== undefined && { retailPrice: payload.retailPrice }),
          ...(payload.wholesalePrice !== undefined && { wholesalePrice: payload.wholesalePrice }),
          ...(payload.isActive !== undefined && { isActive: payload.isActive }),
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              brand: { select: { id: true, name: true } },
            },
          },
        },
      })

      // Recalculate product prices if stock or price changed
      if (payload.stock !== undefined || payload.retailPrice !== undefined) {
        await recalcProductPrices(tx, variant.productId)
      }

      return result
    })

    return this.formatVariantResponse(updated)
  }

  async updateProduct(id: string, payload: { isActive?: boolean; isFeatured?: boolean; isProfessional?: boolean }) {
    const product = await db.product.findUnique({ where: { id } })

    if (!product) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Товар не найден')
    }

    const updated = await db.product.update({
      where: { id },
      data: {
        ...(payload.isActive !== undefined && { isActive: payload.isActive }),
        ...(payload.isFeatured !== undefined && { isFeatured: payload.isFeatured }),
        ...(payload.isProfessional !== undefined && { isProfessional: payload.isProfessional }),
      },
      include: {
        brand: { select: { id: true, name: true } },
      },
    })

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      isActive: updated.isActive,
      isFeatured: updated.isFeatured,
      isProfessional: updated.isProfessional,
      minPrice: updated.minPrice,
      maxPrice: updated.maxPrice,
      brand: updated.brand,
    }
  }

  private formatVariantResponse(variant: any) {
    return {
      id: variant.id,
      productId: variant.productId,
      product: {
        id: variant.product.id,
        name: variant.product.name,
        slug: variant.product.slug,
        brand: variant.product.brand,
      },
      volumeValue: variant.volumeValue,
      volumeUnit: variant.volumeUnit,
      volumeLabel: variant.volumeLabel,
      retailPrice: variant.retailPrice,
      oldRetailPrice: variant.oldRetailPrice,
      wholesalePrice: variant.wholesalePrice,
      stock: variant.stock,
      sku: variant.sku,
      isActive: variant.isActive,
      isProfessional: variant.isProfessional,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    }
  }

  async getPopular() {
    const products = await db.product.findMany({
      where: { popularPin: { not: null }, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        images: true,
        minPrice: true,
        popularPin: true,
      },
      orderBy: { popularPin: 'asc' },
    })

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      image: p.images[0] || null,
      minPrice: p.minPrice,
      popularPin: p.popularPin,
    }))
  }

  async setPopular(productIds: string[]) {
    // Validate max count
    if (productIds.length > 20) {
      throw new ApiError(400, 'TOO_MANY_PRODUCTS', 'Максимум 20 товаров')
    }

    // Verify all products exist
    const existing = await db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    })

    if (existing.length !== productIds.length) {
      throw new ApiError(400, 'PRODUCT_NOT_FOUND', 'Некоторые товары не найдены')
    }

    // Transaction: clear all pins, then set new ones
    await db.$transaction(async (tx) => {
      // Clear all existing pins
      await tx.product.updateMany({
        where: { popularPin: { not: null } },
        data: { popularPin: null },
      })

      // Set new pins by order
      for (let i = 0; i < productIds.length; i++) {
        await tx.product.update({
          where: { id: productIds[i] },
          data: { popularPin: i + 1 },
        })
      }
    })
  }

  async getProduct(id: string) {
    const product = await db.product.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true } },
        line: { select: { id: true, name: true } },
        categories: {
          select: { categoryId: true },
        },
        variants: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!product) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Товар не найден')
    }

    return {
      ...product,
      categoryIds: product.categories.map((c) => c.categoryId),
    }
  }

  async createProduct(payload: {
    name: string
    slug: string
    description: string
    shortDescription?: string
    brandId?: string | null
    lineId?: string | null
    categoryIds?: string[]
    skinTypes?: any[]
    concerns?: any[]
    usage?: string
    inciText?: string
    seoTitle?: string
    seoDescription?: string
  }) {
    // Check slug uniqueness
    const existing = await db.product.findFirst({ where: { slug: payload.slug } })
    if (existing) {
      throw new ApiError(409, 'SLUG_EXISTS', 'Slug должен быть уникальным')
    }

    const created = await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: payload.name,
          slug: payload.slug,
          description: payload.description,
          shortDescription: payload.shortDescription,
          brandId: payload.brandId,
          lineId: payload.lineId,
          skinTypes: payload.skinTypes || [],
          concerns: payload.concerns || [],
          usage: payload.usage,
          inciText: payload.inciText,
          seoTitle: payload.seoTitle,
          seoDescription: payload.seoDescription,
        },
        include: {
          brand: { select: { id: true, name: true } },
          line: { select: { id: true, name: true } },
        },
      })

      // Link categories
      if (payload.categoryIds && payload.categoryIds.length > 0) {
        await tx.productCategory.createMany({
          data: payload.categoryIds.map((categoryId) => ({
            productId: product.id,
            categoryId,
          })),
        })
      }

      return product
    })

    return created
  }

  async updateProductFull(
    id: string,
    payload: {
      name?: string
      slug?: string
      shortDescription?: string | null
      description?: string
      brandId?: string | null
      lineId?: string | null
      categoryIds?: string[]
      skinTypes?: any[]
      concerns?: any[]
      usage?: string | null
      inciText?: string | null
      seoTitle?: string | null
      seoDescription?: string | null
      isActive?: boolean
      isFeatured?: boolean
      isProfessional?: boolean
    }
  ) {
    const product = await db.product.findUnique({ where: { id } })
    if (!product) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Товар не найден')
    }

    // Check slug uniqueness if slug changed
    if (payload.slug && payload.slug !== product.slug) {
      const existing = await db.product.findFirst({ where: { slug: payload.slug } })
      if (existing) {
        throw new ApiError(409, 'SLUG_EXISTS', 'Slug должен быть уникальным')
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.product.update({
        where: { id },
        data: {
          ...(payload.name !== undefined && { name: payload.name }),
          ...(payload.slug !== undefined && { slug: payload.slug }),
          ...(payload.shortDescription !== undefined && { shortDescription: payload.shortDescription }),
          ...(payload.description !== undefined && { description: payload.description }),
          ...(payload.brandId !== undefined && { brandId: payload.brandId }),
          ...(payload.lineId !== undefined && { lineId: payload.lineId }),
          ...(payload.skinTypes !== undefined && { skinTypes: payload.skinTypes }),
          ...(payload.concerns !== undefined && { concerns: payload.concerns }),
          ...(payload.usage !== undefined && { usage: payload.usage }),
          ...(payload.inciText !== undefined && { inciText: payload.inciText }),
          ...(payload.seoTitle !== undefined && { seoTitle: payload.seoTitle }),
          ...(payload.seoDescription !== undefined && { seoDescription: payload.seoDescription }),
          ...(payload.isActive !== undefined && { isActive: payload.isActive }),
          ...(payload.isFeatured !== undefined && { isFeatured: payload.isFeatured }),
          ...(payload.isProfessional !== undefined && { isProfessional: payload.isProfessional }),
        },
        include: {
          brand: { select: { id: true, name: true } },
          line: { select: { id: true, name: true } },
          categories: { select: { categoryId: true } },
        },
      })

      // Update categories if provided
      if (payload.categoryIds !== undefined) {
        // Remove old
        await tx.productCategory.deleteMany({ where: { productId: id } })
        // Add new
        if (payload.categoryIds.length > 0) {
          await tx.productCategory.createMany({
            data: payload.categoryIds.map((categoryId) => ({
              productId: id,
              categoryId,
            })),
          })
        }
      }

      return result
    })

    return updated
  }

  async createVariant(productId: string, payload: {
    volumeValue: number
    volumeUnit: 'ml' | 'g' | 'pcs'
    volumeLabel?: string
    retailPrice: number
    wholesalePrice?: number | null
    stock?: number
    sku?: string
    isActive?: boolean
    isProfessional?: boolean
  }) {
    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Товар не найден')
    }

    const created = await db.$transaction(async (tx) => {
      const variant = await tx.productVariant.create({
        data: {
          productId,
          volumeValue: payload.volumeValue,
          volumeUnit: payload.volumeUnit,
          volumeLabel: payload.volumeLabel,
          retailPrice: payload.retailPrice,
          wholesalePrice: payload.wholesalePrice,
          stock: payload.stock || 0,
          sku: payload.sku,
          isActive: payload.isActive !== false,
          isProfessional: payload.isProfessional || false,
        },
        include: {
          product: { select: { id: true, name: true } },
        },
      })

      // Recalc prices
      await recalcProductPrices(tx, productId)

      return variant
    })

    return this.formatVariantResponse(created)
  }

  async deleteVariant(id: string) {
    const variant = await db.productVariant.findUnique({
      where: { id },
      include: { product: { select: { id: true } } },
    })

    if (!variant) {
      throw new ApiError(404, 'VARIANT_NOT_FOUND', 'Фасовка не найдена')
    }

    await db.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id },
        data: { isActive: false },
      })

      // Recalc prices
      await recalcProductPrices(tx, variant.productId)
    })
  }

  async updateProductImages(id: string, images: string[]) {
    const product = await db.product.findUnique({ where: { id } })
    if (!product) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Товар не найден')
    }

    await db.product.update({
      where: { id },
      data: { images },
    })
  }
}

export const adminProductService = new AdminProductService()
