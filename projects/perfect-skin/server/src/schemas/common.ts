import type { FastifyInstance } from 'fastify'

export function registerCommonSchemas(app: FastifyInstance) {
  app.addSchema({
    $id: 'ps.error',
    type: 'object',
    additionalProperties: false,
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'message'],
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: { type: 'object', additionalProperties: true },
        },
      },
    },
  })

  app.addSchema({
    $id: 'ps.variant',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'volumeValue', 'volumeUnit', 'volumeLabel', 'retailPrice', 'stock', 'sku'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      volumeValue: { type: 'number' },
      volumeUnit: { type: 'string', enum: ['ml', 'g', 'pcs'] },
      volumeLabel: { type: 'string' },
      retailPrice: { type: 'integer' },
      oldRetailPrice: { type: ['integer', 'null'] },
      stock: { type: 'integer' },
      sku: { type: ['string', 'null'] },
    },
  })

  app.addSchema({
    $id: 'ps.productCard',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'slug', 'name', 'skinTypes', 'needs', 'minPrice', 'inStock', 'variants'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      slug: { type: 'string' },
      name: { type: 'string' },
      brand: {
        type: ['object', 'null'],
        additionalProperties: false,
        required: ['id', 'name', 'slug'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
        },
      },
      line: {
        type: ['object', 'null'],
        additionalProperties: false,
        required: ['id', 'name', 'slug'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
        },
      },
      image: { type: ['string', 'null'] },
      skinTypes: { type: 'array', items: { type: 'string' } },
      needs: { type: 'array', items: { type: 'string' } },
      minPrice: { type: 'integer' },
      oldPrice: { type: ['integer', 'null'] },
      inStock: { type: 'boolean' },
      variants: { type: 'array', items: { $ref: 'ps.variant#' } },
    },
  })

  app.addSchema({
    $id: 'ps.productCardFull',
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'slug',
      'name',
      'skinTypes',
      'needs',
      'minPrice',
      'inStock',
      'variants',
      'images',
      'description',
      'ingredients',
      'categories',
      'seo',
    ],
    properties: {
      id: { type: 'string', format: 'uuid' },
      slug: { type: 'string' },
      name: { type: 'string' },
      brand: {
        type: ['object', 'null'],
        additionalProperties: false,
        required: ['id', 'name', 'slug'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
        },
      },
      line: {
        type: ['object', 'null'],
        additionalProperties: false,
        required: ['id', 'name', 'slug'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
        },
      },
      image: { type: ['string', 'null'] },
      skinTypes: { type: 'array', items: { type: 'string' } },
      needs: { type: 'array', items: { type: 'string' } },
      minPrice: { type: 'integer' },
      oldPrice: { type: ['integer', 'null'] },
      inStock: { type: 'boolean' },
      variants: { type: 'array', items: { $ref: 'ps.variant#' } },
      images: { type: 'array', items: { type: 'string' } },
      shortDescription: { type: ['string', 'null'] },
      description: { type: 'string' },
      usage: { type: ['string', 'null'] },
      inciText: { type: ['string', 'null'] },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'slug', 'isKey'],
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
            concentration: { type: ['string', 'null'] },
            isKey: { type: 'boolean' },
          },
        },
      },
      categories: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'slug'],
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
          },
        },
      },
      seo: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
        },
      },
    },
  })

  app.addSchema({
    $id: 'ps.productList',
    type: 'object',
    additionalProperties: false,
    required: ['items', 'total', 'limit', 'offset'],
    properties: {
      items: { type: 'array', items: { $ref: 'ps.productCard#' } },
      total: { type: 'integer' },
      limit: { type: 'integer' },
      offset: { type: 'integer' },
    },
  })

  app.addSchema({
    $id: 'ps.facets',
    type: 'object',
    additionalProperties: false,
    required: ['categories', 'brands', 'lines', 'needs', 'skinTypes', 'price'],
    properties: {
      categories: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['value', 'label', 'count'],
          properties: {
            value: { type: 'string' },
            label: { type: 'string' },
            count: { type: 'integer' },
          },
        },
      },
      brands: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['value', 'label', 'count'],
          properties: {
            value: { type: 'string' },
            label: { type: 'string' },
            count: { type: 'integer' },
          },
        },
      },
      lines: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['value', 'label', 'count'],
          properties: {
            value: { type: 'string' },
            label: { type: 'string' },
            count: { type: 'integer' },
          },
        },
      },
      needs: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['value', 'label', 'count'],
          properties: {
            value: { type: 'string' },
            label: { type: 'string' },
            count: { type: 'integer' },
          },
        },
      },
      skinTypes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['value', 'label', 'count'],
          properties: {
            value: { type: 'string' },
            label: { type: 'string' },
            count: { type: 'integer' },
          },
        },
      },
      price: {
        type: 'object',
        additionalProperties: false,
        required: ['min', 'max'],
        properties: {
          min: { type: 'integer' },
          max: { type: 'integer' },
        },
      },
    },
  })

  app.addSchema({
    $id: 'ps.category',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'name', 'slug', 'productCount', 'children'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      slug: { type: 'string' },
      image: { type: ['string', 'null'] },
      productCount: { type: 'integer' },
      children: {
        type: 'array',
        items: {
          $ref: 'ps.category#',
        },
      },
    },
  })

  app.addSchema({
    $id: 'ps.categoryDetail',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'name', 'slug', 'productCount'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: ['string', 'null'] },
      image: { type: ['string', 'null'] },
      productCount: { type: 'integer' },
      parent: {
        type: ['object', 'null'],
        additionalProperties: false,
        required: ['name', 'slug'],
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
        },
      },
      seo: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
        },
      },
    },
  })

  app.addSchema({
    $id: 'ps.brand',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'name', 'slug', 'productCount'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      slug: { type: 'string' },
      logo: { type: ['string', 'null'] },
      productCount: { type: 'integer' },
    },
  })

  app.addSchema({
    $id: 'ps.brandDetail',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'name', 'slug', 'productCount', 'lines'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      slug: { type: 'string' },
      logo: { type: ['string', 'null'] },
      description: { type: ['string', 'null'] },
      country: { type: ['string', 'null'] },
      manufacturer: { type: ['string', 'null'] },
      productCount: { type: 'integer' },
      lines: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'name', 'slug', 'productCount'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            slug: { type: 'string' },
            productCount: { type: 'integer' },
          },
        },
      },
      seo: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
        },
      },
    },
  })

  app.addSchema({
    $id: 'ps.line',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'name', 'slug', 'brand', 'productCount'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      slug: { type: 'string' },
      brand: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'slug'],
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
        },
      },
      productCount: { type: 'integer' },
    },
  })

  // Cart and checkout schemas
  app.addSchema({
    $id: 'ps.cartItem',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'productId', 'variantId', 'quantity', 'product', 'variant', 'lineTotal'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      productId: { type: 'string', format: 'uuid' },
      variantId: { type: 'string', format: 'uuid' },
      quantity: { type: 'integer' },
      product: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'slug', 'brandName'],
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
          image: { type: ['string', 'null'] },
          brandName: { type: 'string' },
        },
      },
      variant: {
        type: 'object',
        additionalProperties: false,
        required: ['volumeLabel', 'retailPrice', 'stock'],
        properties: {
          volumeLabel: { type: 'string' },
          retailPrice: { type: 'integer' },
          oldRetailPrice: { type: ['integer', 'null'] },
          stock: { type: 'integer' },
        },
      },
      lineTotal: { type: 'integer' },
    },
  })

  app.addSchema({
    $id: 'ps.cartWarning',
    type: 'object',
    additionalProperties: false,
    required: ['code', 'itemId'],
    properties: {
      code: { type: 'string', enum: ['STOCK_REDUCED', 'ITEM_UNAVAILABLE'] },
      itemId: { type: 'string', format: 'uuid' },
      available: { type: ['integer', 'null'] },
      message: { type: 'string' },
    },
  })

  app.addSchema({
    $id: 'ps.cart',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'items', 'itemsCount', 'subtotal', 'warnings'],
    properties: {
      id: { type: ['string', 'null'], format: 'uuid' },
      items: {
        type: 'array',
        items: { $ref: 'ps.cartItem#' },
      },
      itemsCount: { type: 'integer' },
      subtotal: { type: 'integer' },
      warnings: {
        type: 'array',
        items: { $ref: 'ps.cartWarning#' },
      },
    },
  })

  app.addSchema({
    $id: 'ps.promoResponse',
    type: 'object',
    additionalProperties: false,
    required: ['code', 'percent', 'discount', 'subtotal'],
    properties: {
      code: { type: 'string' },
      percent: { type: 'integer' },
      discount: { type: 'integer' },
      subtotal: { type: 'integer' },
    },
  })

  app.addSchema({
    $id: 'ps.deliveryMethod',
    type: 'object',
    additionalProperties: false,
    required: ['code', 'title', 'cost', 'isFree', 'freeFrom', 'amountToFree', 'requiresAddress', 'requiresPvzCode'],
    properties: {
      code: { type: 'string', enum: ['pickup', 'cdek_pvz', 'cdek_courier'] },
      title: { type: 'string' },
      hint: { type: 'string' },
      cost: { type: 'integer' },
      isFree: { type: 'boolean' },
      freeFrom: { type: ['integer', 'null'] },
      amountToFree: { type: 'integer' },
      requiresAddress: { type: 'boolean' },
      requiresPvzCode: { type: 'boolean' },
    },
  })

  app.addSchema({
    $id: 'ps.deliveryMethods',
    type: 'object',
    additionalProperties: false,
    required: ['subtotal', 'goodsAfterDiscount', 'methods'],
    properties: {
      subtotal: { type: 'integer' },
      promo: { anyOf: [{ $ref: 'ps.promoResponse#' }, { type: 'null' }] },
      goodsAfterDiscount: { type: 'integer' },
      methods: {
        type: 'array',
        items: { $ref: 'ps.deliveryMethod#' },
      },
    },
  })

  app.addSchema({
    $id: 'ps.orderItem',
    type: 'object',
    additionalProperties: false,
    required: ['productName', 'brandName', 'volumeLabel', 'price', 'quantity', 'lineTotal', 'productSlug'],
    properties: {
      productName: { type: 'string' },
      brandName: { type: 'string' },
      volumeLabel: { type: 'string' },
      price: { type: 'integer' },
      quantity: { type: 'integer' },
      lineTotal: { type: 'integer' },
      productSlug: { type: 'string' },
      image: { type: ['string', 'null'] },
    },
  })

  app.addSchema({
    $id: 'ps.orderPayment',
    type: 'object',
    additionalProperties: false,
    required: ['status', 'provider', 'confirmationUrl', 'paymentStatus'],
    properties: {
      status: { type: 'string', const: 'not_implemented' },
      provider: { type: 'string' },
      confirmationUrl: { type: ['string', 'null'] },
      paymentStatus: { type: 'string', enum: ['pending', 'paid', 'failed', 'cancelled'] },
    },
  })

  app.addSchema({
    $id: 'ps.order',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'number', 'status', 'createdAt', 'deliveryMethod', 'recipient', 'items', 'subtotal', 'deliveryCost', 'total', 'payment'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      number: { type: 'string' },
      status: { type: 'string', enum: ['new', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] },
      createdAt: { type: 'string', format: 'date-time' },
      deliveryMethod: { type: 'string', enum: ['pickup', 'cdek_pvz', 'cdek_courier'] },
      cdekPvzCode: { type: ['string', 'null'] },
      deliveryAddress: { type: ['object', 'null'] },
      recipient: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'phone'],
        properties: {
          name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: ['string', 'null'] },
        },
      },
      items: {
        type: 'array',
        items: { $ref: 'ps.orderItem#' },
      },
      subtotal: { type: 'integer' },
      promo: { anyOf: [{ $ref: 'ps.promoResponse#' }, { type: 'null' }] },
      deliveryCost: { type: 'integer' },
      total: { type: 'integer' },
      comment: { type: ['string', 'null'] },
      payment: { $ref: 'ps.orderPayment#' },
    },
  })

  app.addSchema({
    $id: 'ps.ordersList',
    type: 'object',
    additionalProperties: false,
    required: ['items', 'total', 'limit', 'offset'],
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'number', 'status', 'paymentStatus', 'createdAt', 'total', 'itemsCount', 'previewImages'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            number: { type: 'string' },
            status: { type: 'string' },
            paymentStatus: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            total: { type: 'integer' },
            itemsCount: { type: 'integer' },
            previewImages: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
      total: { type: 'integer' },
      limit: { type: 'integer' },
      offset: { type: 'integer' },
    },
  })

  app.addSchema({
    $id: 'ps.user',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'name', 'phone', 'role'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      phone: { type: 'string' },
      email: { type: ['string', 'null'] },
      role: { type: 'string', enum: ['customer', 'admin'] },
    },
  })
}
