export interface Variant {
  id: string
  volumeValue: number
  volumeUnit: 'ml' | 'g' | 'pcs'
  volumeLabel: string
  retailPrice: number
  oldRetailPrice: number | null
  stock: number
  sku: string | null
}

export interface Brand {
  id: string
  name: string
  slug: string
}

export interface ProductLine {
  id: string
  name: string
  slug: string
}

export interface ProductCard {
  id: string
  slug: string
  name: string
  brand: Brand | null
  line: ProductLine | null
  image: string | null
  skinTypes: string[]
  needs: string[]
  minPrice: number
  oldPrice: number | null
  inStock: boolean
  variants: Variant[]
}

export interface ProductCardExtended extends ProductCard {
  images: string[]
  shortDescription: string | null
  description: string
  usage: string | null
  inciText: string | null
  ingredients: Ingredient[]
  categories: Category[]
  seo: {
    title: string | null
    description: string | null
  }
}

export interface Category {
  id?: string
  name: string
  slug: string
  description?: string | null
  image?: string | null
  productCount?: number
  parent?: {
    name: string
    slug: string
  } | null
  children?: Category[]
}

export interface Ingredient {
  name: string
  slug: string
  concentration: string | null
  isKey: boolean
}

export interface CartItem {
  id: string
  productId: string
  variantId: string
  quantity: number
  product: {
    name: string
    slug: string
    image: string | null
    brandName: string
  }
  variant: {
    volumeLabel: string
    retailPrice: number
    oldRetailPrice: number | null
    stock: number
  }
  lineTotal: number
}

export interface CartWarning {
  code: 'STOCK_REDUCED' | 'ITEM_UNAVAILABLE'
  itemId: string
  available?: number
  message: string
}

export interface Cart {
  id: string | null
  items: CartItem[]
  itemsCount: number
  subtotal: number
  warnings: CartWarning[]
}

export interface FacetGroup {
  value: string
  label: string
  count: number
}

export interface Facets {
  categories: FacetGroup[]
  brands: FacetGroup[]
  lines: FacetGroup[]
  needs: FacetGroup[]
  skinTypes: FacetGroup[]
  price: {
    min: number
    max: number
  }
}

export interface ProductsListResponse {
  items: ProductCard[]
  total: number
  limit: number
  offset: number
}

export interface CategoriesTreeResponse {
  id: string
  name: string
  slug: string
  image: string | null
  productCount: number
  children: CategoriesTreeResponse[]
}

export interface BrandDetails extends Brand {
  logo: string | null
  description: string | null
  country: string | null
  manufacturer: string | null
  productCount: number
  lines: ProductLine[]
  seo: {
    title: string | null
    description: string | null
  }
}

export interface BrandsListResponse extends Brand {
  logo: string | null
  productCount: number
}
