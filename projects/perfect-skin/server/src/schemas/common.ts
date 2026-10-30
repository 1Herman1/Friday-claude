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
    required: ['id', 'volumeValue', 'volumeUnit', 'volumeLabel', 'retailPrice', 'stock', 'sku', 'isProfessional', 'priceHidden'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      volumeValue: { type: 'number' },
      volumeUnit: { type: 'string', enum: ['ml', 'g', 'pcs'] },
      volumeLabel: { type: 'string' },
      retailPrice: { type: ['integer', 'null'] },
      oldRetailPrice: { type: ['integer', 'null'] },
      stock: { type: 'integer' },
      sku: { type: ['string', 'null'] },
      isProfessional: { type: 'boolean' },
      priceHidden: { type: 'boolean' },
    },
  })

  app.addSchema({
    $id: 'ps.productCard',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'slug', 'name', 'skinTypes', 'needs', 'minPrice', 'inStock', 'variants', 'isProfessional', 'priceHidden'],
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
      minPrice: { type: ['integer', 'null'] },
      oldPrice: { type: ['integer', 'null'] },
      inStock: { type: 'boolean' },
      isProfessional: { type: 'boolean' },
      priceHidden: { type: 'boolean' },
      variants: { type: 'array', items: { $ref: 'ps.variant#' } },
    },
  })

  // Карточка «Аптечная карта»: формат — server/src/lib/product-details.ts. Каждый уровень
  // с additionalProperties: false, иначе fast-json-stringify молча вырежет поле.
  app.addSchema({
    $id: 'ps.detailsItem',
    type: 'object',
    additionalProperties: false,
    required: ['title', 'text'],
    properties: {
      title: { type: ['string', 'null'] },
      text: { type: 'string' },
    },
  })

  app.addSchema({
    $id: 'ps.detailsHowItWorks',
    type: 'object',
    additionalProperties: false,
    required: ['heading', 'lead', 'items', 'result'],
    properties: {
      heading: { type: 'string' },
      lead: { type: 'array', items: { type: 'string' } },
      items: { type: 'array', items: { $ref: 'ps.detailsItem#' } },
      result: { type: ['string', 'null'] },
    },
  })

  app.addSchema({
    $id: 'ps.detailsForWhom',
    type: 'object',
    additionalProperties: false,
    required: ['lead', 'items', 'note'],
    properties: {
      lead: { type: ['string', 'null'] },
      items: { type: 'array', items: { type: 'string' } },
      note: { type: 'array', items: { type: 'string' } },
    },
  })

  app.addSchema({
    $id: 'ps.detailsUsage',
    type: 'object',
    additionalProperties: false,
    required: ['heading', 'steps', 'notes'],
    properties: {
      heading: { type: 'string' },
      steps: { type: 'array', items: { $ref: 'ps.detailsItem#' } },
      notes: { type: 'array', items: { type: 'string' } },
    },
  })

  app.addSchema({
    $id: 'ps.detailsPro',
    type: 'object',
    additionalProperties: false,
    required: ['volumeLabel', 'tagline', 'intro', 'howItWorks', 'forWhom', 'actives', 'usage'],
    properties: {
      volumeLabel: { type: 'string' },
      tagline: { type: 'array', items: { type: 'string' } },
      intro: { type: 'array', items: { type: 'string' } },
      howItWorks: { anyOf: [{ $ref: 'ps.detailsHowItWorks#' }, { type: 'null' }] },
      forWhom: { anyOf: [{ $ref: 'ps.detailsForWhom#' }, { type: 'null' }] },
      actives: { type: 'array', items: { type: 'string' } },
      usage: { anyOf: [{ $ref: 'ps.detailsUsage#' }, { type: 'null' }] },
    },
  })

  app.addSchema({
    $id: 'ps.productDetails',
    type: 'object',
    additionalProperties: false,
    required: ['v', 'tagline', 'intro', 'extra', 'howItWorks', 'actives', 'forWhom', 'usage', 'lifehack', 'pro'],
    properties: {
      v: { type: 'integer' },
      tagline: { type: 'array', items: { type: 'string' } },
      intro: { type: 'array', items: { type: 'string' } },
      extra: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['heading', 'paragraphs', 'items'],
          properties: {
            heading: { type: 'string' },
            paragraphs: { type: 'array', items: { type: 'string' } },
            items: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      howItWorks: { anyOf: [{ $ref: 'ps.detailsHowItWorks#' }, { type: 'null' }] },
      actives: { type: 'array', items: { type: 'string' } },
      forWhom: { anyOf: [{ $ref: 'ps.detailsForWhom#' }, { type: 'null' }] },
      usage: { anyOf: [{ $ref: 'ps.detailsUsage#' }, { type: 'null' }] },
      lifehack: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'paragraphs'],
            properties: {
              title: { type: ['string', 'null'] },
              paragraphs: { type: 'array', items: { type: 'string' } },
            },
          },
          { type: 'null' },
        ],
      },
      pro: { anyOf: [{ $ref: 'ps.detailsPro#' }, { type: 'null' }] },
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
      'details',
      'ingredients',
      'categories',
      'seo',
      'isProfessional',
      'priceHidden',
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
      minPrice: { type: ['integer', 'null'] },
      oldPrice: { type: ['integer', 'null'] },
      inStock: { type: 'boolean' },
      isProfessional: { type: 'boolean' },
      priceHidden: { type: 'boolean' },
      variants: { type: 'array', items: { $ref: 'ps.variant#' } },
      images: { type: 'array', items: { type: 'string' } },
      shortDescription: { type: ['string', 'null'] },
      description: { type: 'string' },
      details: { anyOf: [{ $ref: 'ps.productDetails#' }, { type: 'null' }] },
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
    required: [
      'code', 'title', 'cost', 'isFree', 'freeFrom', 'amountToFree', 'requiresAddress', 'requiresPvzCode',
      'requiresCity', 'available', 'quoteSource', 'periodMin', 'periodMax', 'costByPointType',
    ],
    properties: {
      code: { type: 'string', enum: ['pickup', 'cdek_pvz', 'cdek_courier'] },
      title: { type: 'string' },
      hint: { type: 'string' },
      cost: { type: ['integer', 'null'] },
      isFree: { type: 'boolean' },
      freeFrom: { type: ['integer', 'null'] },
      amountToFree: { type: 'integer' },
      requiresAddress: { type: 'boolean' },
      requiresPvzCode: { type: 'boolean' },
      requiresCity: { type: 'boolean' },
      available: { type: 'boolean' },
      quoteSource: { type: 'string', enum: ['fixed', 'cdek', 'fallback', 'free', 'needs_city', 'unavailable'] },
      periodMin: { type: ['integer', 'null'] },
      periodMax: { type: ['integer', 'null'] },
      costByPointType: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['PVZ', 'POSTAMAT'],
            properties: { PVZ: { type: ['integer', 'null'] }, POSTAMAT: { type: ['integer', 'null'] } },
          },
          { type: 'null' },
        ],
      },
    },
  })

  app.addSchema({
    $id: 'ps.cdekCity',
    type: 'object',
    additionalProperties: false,
    required: ['code', 'name'],
    properties: { code: { type: 'integer' }, name: { type: 'string' } },
  })

  app.addSchema({
    $id: 'ps.cdekPoint',
    type: 'object',
    additionalProperties: false,
    required: ['code', 'type', 'name', 'address', 'workTime', 'metro', 'lat', 'lon'],
    properties: {
      code: { type: 'string' },
      type: { type: 'string', enum: ['PVZ', 'POSTAMAT'] },
      name: { type: 'string' },
      address: { type: 'string' },
      workTime: { type: ['string', 'null'] },
      metro: { type: ['string', 'null'] },
      lat: { type: 'number' },
      lon: { type: 'number' },
    },
  })

  app.addSchema({
    $id: 'ps.deliveryMethods',
    type: 'object',
    additionalProperties: false,
    required: ['subtotal', 'goodsAfterDiscount', 'cdekEnabled', 'methods'],
    properties: {
      subtotal: { type: 'integer' },
      promo: { anyOf: [{ $ref: 'ps.promoResponse#' }, { type: 'null' }] },
      goodsAfterDiscount: { type: 'integer' },
      cdekEnabled: { type: 'boolean' },
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
      paymentStatus: { type: 'string', enum: ['pending', 'paid', 'failed', 'refunded'] },
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
      status: { type: 'string', enum: ['new', 'confirmed', 'packed', 'in_transit', 'delivered', 'cancelled'] },
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
      role: { type: 'string', enum: ['customer', 'professional', 'super_admin', 'orders_manager', 'products_manager', 'content_manager'] },
      proStatus: { type: ['string', 'null'], enum: ['none', 'pending', 'approved', 'rejected', null] },
      companyName: { type: ['string', 'null'] },
      inn: { type: ['string', 'null'] },
      specialization: { type: ['string', 'null'] },
      proRequestedAt: { type: ['string', 'null'], format: 'date-time' },
      proReviewedAt: { type: ['string', 'null'], format: 'date-time' },
      proRejectReason: { type: ['string', 'null'] },
    },
  })

  app.addSchema({
    $id: 'ps.adminVariant',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'productId', 'product', 'volumeValue', 'volumeUnit', 'retailPrice', 'stock', 'isActive', 'isProfessional'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      productId: { type: 'string', format: 'uuid' },
      product: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'slug'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          brand: {
            type: ['object', 'null'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
            },
          },
        },
      },
      volumeValue: { type: 'number' },
      volumeUnit: { type: 'string', enum: ['ml', 'g', 'pcs'] },
      volumeLabel: { type: ['string', 'null'] },
      retailPrice: { type: 'integer' },
      oldRetailPrice: { type: ['integer', 'null'] },
      wholesalePrice: { type: ['integer', 'null'] },
      stock: { type: 'integer' },
      sku: { type: ['string', 'null'] },
      isActive: { type: 'boolean' },
      isProfessional: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  })

  app.addSchema({
    $id: 'ps.adminOrder',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'number', 'status', 'paymentStatus', 'createdAt', 'updatedAt', 'recipient', 'user', 'items', 'subtotal', 'deliveryCost', 'total'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      number: { type: 'string' },
      status: { type: 'string', enum: ['new', 'confirmed', 'packed', 'in_transit', 'delivered', 'cancelled'] },
      paymentStatus: { type: 'string', enum: ['pending', 'paid', 'failed', 'refunded'] },
      deliveryTrackNumber: { type: ['string', 'null'] },
      adminNote: { type: ['string', 'null'] },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      deliveryMethod: { type: 'string', enum: ['pickup', 'cdek_pvz', 'cdek_courier'] },
      cdekPvzCode: { type: ['string', 'null'] },
      deliveryAddress: { type: ['object', 'null'] },
      user: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: ['string', 'null'] },
          phone: { type: ['string', 'null'] },
          email: { type: ['string', 'null'] },
        },
      },
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
      paidAt: { type: ['string', 'null'], format: 'date-time' },
    },
  })

  // Admin promo schemas
  app.addSchema({
    $id: 'ps.adminPartner',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'name', 'commissionPercent', 'isActive', 'codesCount', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      contact: { type: ['string', 'null'] },
      commissionPercent: { type: 'integer', minimum: 0, maximum: 100 },
      isActive: { type: 'boolean' },
      codesCount: { type: 'integer' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  })

  app.addSchema({
    $id: 'ps.adminPromoCode',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'code', 'percent', 'partner', 'usedCount', 'isActive', 'createdAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      code: { type: 'string' },
      percent: { type: 'integer', minimum: 0, maximum: 100 },
      partner: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'name'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
            },
          },
          { type: 'null' },
        ],
      },
      maxRedemptions: { type: ['integer', 'null'] },
      usedCount: { type: 'integer' },
      minOrderAmount: { type: ['integer', 'null'] },
      startsAt: { type: ['string', 'null'], format: 'date-time' },
      expiresAt: { type: ['string', 'null'], format: 'date-time' },
      isActive: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  })

  app.addSchema({
    $id: 'ps.payoutReportRow',
    type: 'object',
    additionalProperties: false,
    required: [
      'partnerId',
      'partnerName',
      'commissionPercent',
      'ordersCount',
      'paidOrdersCount',
      'revenue',
      'clientDiscount',
      'payout',
    ],
    properties: {
      partnerId: { type: 'string', format: 'uuid' },
      partnerName: { type: 'string' },
      commissionPercent: { type: 'integer', minimum: 0, maximum: 100 },
      ordersCount: { type: 'integer' },
      paidOrdersCount: { type: 'integer' },
      revenue: { type: 'integer' },
      clientDiscount: { type: 'integer' },
      payout: { type: 'integer' },
    },
  })

  app.addSchema({
    $id: 'ps.payoutReportTotals',
    type: 'object',
    additionalProperties: false,
    required: ['ordersCount', 'paidOrdersCount', 'revenue', 'clientDiscount', 'payout'],
    properties: {
      ordersCount: { type: 'integer' },
      paidOrdersCount: { type: 'integer' },
      revenue: { type: 'integer' },
      clientDiscount: { type: 'integer' },
      payout: { type: 'integer' },
    },
  })
  app.addSchema({
    $id: 'ps.postListItem',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'slug', 'title', 'excerpt', 'coverImage', 'kind', 'publishedAt', 'createdAt', 'isAd', 'advertiser', 'erid'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      slug: { type: 'string' },
      title: { type: 'string' },
      excerpt: { type: ['string', 'null'] },
      coverImage: { type: ['string', 'null'] },
      kind: { type: 'string', enum: ['article', 'news'] },
      publishedAt: { type: 'string', format: 'date-time' },
      createdAt: { type: 'string', format: 'date-time' },
      isAd: { type: 'boolean' },
      advertiser: { type: ['string', 'null'] },
      erid: { type: ['string', 'null'] },
    },
  })

  app.addSchema({
    $id: 'ps.postList',
    type: 'object',
    additionalProperties: false,
    required: ['items', 'total', 'limit', 'offset'],
    properties: {
      items: { type: 'array', items: { $ref: 'ps.postListItem#' } },
      total: { type: 'integer' },
      limit: { type: 'integer' },
      offset: { type: 'integer' },
    },
  })

  app.addSchema({
    $id: 'ps.adminPost',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'slug', 'title', 'body', 'kind', 'audience', 'isAd', 'isActive', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      slug: { type: 'string' },
      title: { type: 'string' },
      body: { type: 'string' },
      excerpt: { type: ['string', 'null'] },
      coverImage: { type: ['string', 'null'] },
      kind: { type: 'string', enum: ['article', 'news'] },
      audience: { type: 'string', enum: ['public', 'retail'] },
      isAd: { type: 'boolean' },
      advertiser: { type: ['string', 'null'] },
      erid: { type: ['string', 'null'] },
      seoTitle: { type: ['string', 'null'] },
      seoDescription: { type: ['string', 'null'] },
      publishedAt: { type: ['string', 'null'], format: 'date-time' },
      isActive: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  })

  app.addSchema({
    $id: 'ps.videoReviewPublic',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'authorName', 'caption', 'mp4Url', 'webmUrl', 'posterUrl', 'product'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      authorName: { type: 'string' },
      caption: { type: ['string', 'null'] },
      mp4Url: { type: 'string' },
      webmUrl: { type: ['string', 'null'] },
      posterUrl: { type: 'string' },
      product: {
        type: ['object', 'null'],
        additionalProperties: false,
        required: ['slug', 'name'],
        properties: {
          slug: { type: 'string' },
          name: { type: 'string' },
        },
      },
    },
  })

  app.addSchema({
    $id: 'ps.videoReviewList',
    type: 'object',
    additionalProperties: false,
    required: ['items'],
    properties: {
      items: { type: 'array', items: { $ref: 'ps.videoReviewPublic#' } },
    },
  })

  app.addSchema({
    $id: 'ps.adminVideoReview',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'authorName', 'sortOrder', 'isActive', 'publishable', 'publishBlockers', 'hasConsentDoc', 'consentConfirmed', 'contentReviewed', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      authorName: { type: 'string' },
      caption: { type: ['string', 'null'] },
      product: {
        type: ['object', 'null'],
        additionalProperties: false,
        required: ['id', 'slug', 'name'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          slug: { type: 'string' },
          name: { type: 'string' },
        },
      },
      mp4Url: { type: ['string', 'null'] },
      webmUrl: { type: ['string', 'null'] },
      posterUrl: { type: ['string', 'null'] },
      sortOrder: { type: 'integer' },
      isActive: { type: 'boolean' },
      publishable: { type: 'boolean' },
      publishBlockers: {
        type: 'array',
        items: { type: 'string', enum: ['mp4', 'poster', 'consent', 'consentDoc', 'site', 'review', 'revoked', 'expired'] },
      },
      hasConsentDoc: { type: 'boolean' },
      consentConfirmed: { type: 'boolean' },
      consentConfirmedAt: { type: ['string', 'null'], format: 'date-time' },
      consentConfirmedBy: {
        type: ['object', 'null'],
        additionalProperties: false,
        required: ['id', 'name'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
        },
      },
      consentTemplateVersion: { type: ['string', 'null'] },
      consentAllowSite: { type: 'boolean' },
      consentAllowSocial: { type: 'boolean' },
      consentAllowAds: { type: 'boolean' },
      consentExpiresAt: { type: ['string', 'null'], format: 'date-time' },
      consentRevokedAt: { type: ['string', 'null'], format: 'date-time' },
      consentNote: { type: ['string', 'null'] },
      contentReviewed: { type: 'boolean' },
      contentReviewedAt: { type: ['string', 'null'], format: 'date-time' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  })

  app.addSchema({
    $id: 'ps.adminVideoReviewList',
    type: 'object',
    additionalProperties: false,
    required: ['items'],
    properties: {
      items: { type: 'array', items: { $ref: 'ps.adminVideoReview#' } },
    },
  })
}
