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
}

export const adminProductService = new AdminProductService()
