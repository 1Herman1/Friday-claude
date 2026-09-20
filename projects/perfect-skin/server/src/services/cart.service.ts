import { db, type Prisma } from '../lib/db.js'
import { ApiError } from '../lib/errors.js'
import type { FastifyRequest } from 'fastify'

type CartOwner = { userId: string } | { sessionId: string }

type CartWithItems = Prisma.CartGetPayload<{
  include: {
    items: {
      include: {
        productVariant: {
          include: { product: { include: { brand: true } } }
        }
      }
    }
  }
}>

export class CartService {
  /**
   * Determine cart owner from request.
   * 1. Valid Bearer token → { userId }
   * 2. Signed cookie ps_sid → { sessionId }
   * 3. Neither → return null
   */
  resolveCartOwner(request: FastifyRequest): CartOwner | null {
    // Check for authenticated user
    if (request.user?.id) {
      return { userId: request.user.id }
    }

    // Кука может отсутствовать у первого визита — unsignCookie на undefined кидает.
    const raw = request.cookies.ps_sid
    if (raw) {
      const unsigned = request.unsignCookie(raw)
      if (unsigned.valid && unsigned.value) {
        return { sessionId: unsigned.value }
      }
    }

    return null
  }

  /**
   * Get or create cart for owner.
   * Guests by sessionId get cart without DB insert on read-only.
   */
  async getOrCreateCart(owner: CartOwner): Promise<CartWithItems | null> {
    let cart

    if ('userId' in owner) {
      cart = await db.cart.findUnique({
        where: { userId: owner.userId },
        include: {
          items: {
            include: {
              productVariant: {
                include: { product: { include: { brand: true } } },
              },
            },
          },
        },
      })
    } else {
      cart = await db.cart.findUnique({
        where: { sessionId: owner.sessionId },
        include: {
          items: {
            include: {
              productVariant: {
                include: { product: { include: { brand: true } } },
              },
            },
          },
        },
      })
    }

    return cart
  }

  /**
   * Format cart response with warnings.
   */
  formatCartResponse(
    cart: CartWithItems | null
  ): {
    id: string | null
    items: Array<{
      id: string
      productId: string
      variantId: string
      quantity: number
      product: { name: string; slug: string; image: string | null; brandName: string }
      variant: {
        volumeLabel: string | null
        retailPrice: number
        oldRetailPrice: number | null
        stock: number
      }
      lineTotal: number
    }>
    itemsCount: number
    subtotal: number
    warnings: Array<{
      code: string
      itemId: string
      available: number
      message: string
    }>
  } {
    if (!cart) {
      return {
        id: null,
        items: [],
        itemsCount: 0,
        subtotal: 0,
        warnings: [],
      }
    }

    const items = (cart.items || []).map((item) => {
      const lineTotal = Number(item.productVariant.retailPrice) * item.quantity
      return {
        id: item.id,
        productId: item.productId,
        variantId: item.productVariantId,
        quantity: item.quantity,
        product: {
          name: item.productVariant.product.name,
          slug: item.productVariant.product.slug,
          image: item.productVariant.product.images?.[0] || null,
          brandName: item.productVariant.product.brand?.name || '',
        },
        variant: {
          volumeLabel: item.productVariant.volumeLabel,
          retailPrice: Number(item.productVariant.retailPrice),
          oldRetailPrice: item.productVariant.oldRetailPrice ? Number(item.productVariant.oldRetailPrice) : null,
          stock: item.productVariant.stock || 0,
        },
        lineTotal,
      }
    })

    // Calculate warnings
    const warnings = items
      .map((item) => {
        // Check if item's variant is still active
        if (!item.variant || item.variant.stock < 0) {
          return {
            code: 'ITEM_UNAVAILABLE',
            itemId: item.id,
            available: 0,
            message: 'Товар недоступен',
          }
        }

        // Check if stock reduced
        if (item.quantity > item.variant.stock) {
          return {
            code: 'STOCK_REDUCED',
            itemId: item.id,
            available: item.variant.stock,
            message: `Осталось ${item.variant.stock} шт.`,
          }
        }

        return null
      })
      .filter((w) => w !== null) as Array<{
        code: string
        itemId: string
        available: number
        message: string
      }>

    // Calculate subtotal excluding items with ITEM_UNAVAILABLE warning
    const unavailableItemIds = new Set(
      warnings
        .filter((w) => w.code === 'ITEM_UNAVAILABLE')
        .map((w) => w.itemId)
    )

    const subtotal = items.reduce((sum: number, item) => {
      if (unavailableItemIds.has(item.id)) return sum
      return sum + item.lineTotal
    }, 0)

    return {
      id: cart.id,
      items,
      itemsCount: items.reduce((sum: number, item) => sum + item.quantity, 0),
      subtotal,
      warnings,
    }
  }

  /**
   * Add item to cart. Creates cart if needed for guests.
   */
  async addItem(owner: CartOwner, variantId: string, quantity: number) {
    // Verify variant exists and is active
    const variant = await db.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    })

    if (!variant) {
      throw new ApiError(404, 'VARIANT_NOT_FOUND', 'Фасовка не найдена')
    }

    if (!variant.isActive || variant.deletedAt) {
      throw new ApiError(409, 'ITEM_UNAVAILABLE', 'Товар снят с продажи')
    }

    if (variant.product.isActive === false || variant.product.deletedAt) {
      throw new ApiError(409, 'ITEM_UNAVAILABLE', 'Товар снят с продажи', {
        itemId: variantId,
        productName: variant.product.name,
      })
    }

    if (variant.retailPrice <= 0) {
      throw new ApiError(409, 'ITEM_UNAVAILABLE', 'Товар не готов к продаже')
    }

    // Get or create cart
    let cart

    if ('userId' in owner) {
      cart = await db.cart.findUnique({
        where: { userId: owner.userId },
        include: { items: true },
      })

      if (!cart) {
        cart = await db.cart.create({
          data: { userId: owner.userId },
          include: { items: true },
        })
      }
    } else {
      cart = await db.cart.findUnique({
        where: { sessionId: owner.sessionId },
        include: { items: true },
      })

      if (!cart) {
        cart = await db.cart.create({
          data: { sessionId: owner.sessionId },
          include: { items: true },
        })
      }
    }

    // Check cart item limit
    if (cart.items.length >= 50) {
      throw new ApiError(409, 'CART_ITEM_LIMIT', 'Не более 50 позиций в корзине', {
        limit: 50,
      })
    }

    // Find existing item or create new
    const existingItem = cart.items.find((i: any) => i.productVariantId === variantId)
    const newQuantity = (existingItem?.quantity || 0) + quantity

    // Check stock
    if (newQuantity > variant.stock) {
      throw new ApiError(409, 'OUT_OF_STOCK', 'Недостаточно товара на складе', {
        itemId: variantId,
        productName: variant.product.name,
        available: variant.stock,
      })
    }

    // Upsert cart item
    await db.cartItem.upsert({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId: variantId,
        },
      },
      create: {
        cartId: cart.id,
        productVariantId: variantId,
        productId: variant.productId,
        quantity: newQuantity,
      },
      update: {
        quantity: newQuantity,
      },
    })

    // Return updated cart
    const updatedCart = await this.getOrCreateCart(owner)
    return this.formatCartResponse(updatedCart!)
  }

  /**
   * Update item quantity.
   */
  async updateItem(owner: CartOwner, itemId: string, quantity: number) {
    const item = await db.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true, productVariant: { include: { product: true } } },
    })

    if (!item) {
      throw new ApiError(404, 'CART_ITEM_NOT_FOUND', 'Позиция не найдена')
    }

    // Verify ownership
    const cart = await this.getOrCreateCart(owner)
    if (!cart || cart.id !== item.cartId) {
      throw new ApiError(404, 'CART_ITEM_NOT_FOUND', 'Позиция не найдена')
    }

    // If quantity is 0, delete item
    if (quantity === 0) {
      await db.cartItem.delete({ where: { id: itemId } })
    } else {
      // Check stock
      if (quantity > item.productVariant.stock) {
        throw new ApiError(409, 'OUT_OF_STOCK', 'Недостаточно товара на складе', {
          itemId: item.productVariantId,
          productName: item.productVariant.product.name,
          available: item.productVariant.stock,
        })
      }

      await db.cartItem.update({
        where: { id: itemId },
        data: { quantity },
      })
    }

    // Return updated cart
    const updatedCart = await this.getOrCreateCart(owner)
    return this.formatCartResponse(updatedCart!)
  }

  /**
   * Delete item from cart.
   */
  async deleteItem(owner: CartOwner, itemId: string) {
    const item = await db.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    })

    if (!item) {
      throw new ApiError(404, 'CART_ITEM_NOT_FOUND', 'Позиция не найдена')
    }

    // Verify ownership
    const cart = await this.getOrCreateCart(owner)
    if (!cart || cart.id !== item.cartId) {
      throw new ApiError(404, 'CART_ITEM_NOT_FOUND', 'Позиция не найдена')
    }

    await db.cartItem.delete({ where: { id: itemId } })

    // Return updated cart
    const updatedCart = await this.getOrCreateCart(owner)
    return this.formatCartResponse(updatedCart!)
  }

  /**
   * Clear all items from cart.
   */
  async clearCart(owner: CartOwner) {
    const cart = await this.getOrCreateCart(owner)
    if (cart) {
      await db.cartItem.deleteMany({ where: { cartId: cart.id } })
    }

    // Return empty cart
    const emptyCart = await this.getOrCreateCart(owner)
    return this.formatCartResponse(emptyCart)
  }

  /**
   * Merge guest cart into user cart (only in verify-otp).
   */
  async mergeGuestCart(userId: string, sessionId: string) {
    // Atomic: a crash between item upserts and guest-cart delete would
    // leave the guest cart behind and double-merge on the next login.
    return db.$transaction(async (tx) => {
      const guestCart = await tx.cart.findUnique({
        where: { sessionId },
        include: { items: { include: { productVariant: true } } },
      })

      if (!guestCart) {
        return false
      }

      // Find or create user cart
      let userCart = await tx.cart.findUnique({
        where: { userId },
      })

      if (!userCart) {
        userCart = await tx.cart.create({
          data: { userId },
        })
      }

      // Merge items: upsert by [cartId, productVariantId]
      for (const guestItem of guestCart.items) {
        const availableStock = guestItem.productVariant.stock
        const mergeQuantity = Math.min(guestItem.quantity, availableStock)

        if (mergeQuantity > 0) {
          await tx.cartItem.upsert({
            where: {
              cartId_productVariantId: {
                cartId: userCart.id,
                productVariantId: guestItem.productVariantId,
              },
            },
            create: {
              cartId: userCart.id,
              productVariantId: guestItem.productVariantId,
              productId: guestItem.productId,
              quantity: mergeQuantity,
            },
            update: {
              quantity: { increment: mergeQuantity },
            },
          })
        }
      }

      // Delete guest cart (cascade deletes items)
      await tx.cart.delete({ where: { id: guestCart.id } })

      return true
    })
  }
}

export const cartService = new CartService()
