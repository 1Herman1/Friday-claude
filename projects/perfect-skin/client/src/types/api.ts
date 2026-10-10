export interface Variant {
  id: string
  volumeValue: number
  volumeUnit: 'ml' | 'g' | 'pcs'
  volumeLabel: string
  retailPrice: number | null
  oldRetailPrice: number | null
  wholesalePrice?: number | null
  stock: number
  sku: string | null
  // Фасовка только для кабинета: гостю и рознице цена не отдаётся (null).
  isProfessional?: boolean
  priceHidden?: boolean
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
  minPrice: number | null
  oldPrice: number | null
  priceHidden?: boolean
  isProfessional?: boolean
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
  details?: ProductDetails | null
  seo: {
    title: string | null
    description: string | null
  }
}

export interface Item {
  title: string | null
  text: string
}

export interface HowItWorks {
  heading: string
  lead: string[]
  items: Item[]
  result: string | null
}

export interface ForWhom {
  lead: string | null
  items: string[]
  note: string[]
}

export interface Usage {
  heading: string
  steps: Item[]
  notes: string[]
}

export interface Lifehack {
  title: string | null
  paragraphs: string[]
}

export interface Extra {
  heading: string
  paragraphs: string[]
  items: string[]
}

export interface Pro {
  volumeLabel: string
  tagline: string[]
  intro: string[]
  howItWorks: HowItWorks | null
  forWhom: ForWhom | null
  actives: string[]
  usage: Usage | null
}

export interface ProductDetails {
  v: 1
  tagline: string[]
  intro: string[]
  extra: Extra[]
  howItWorks: HowItWorks | null
  actives: string[]
  forWhom: ForWhom | null
  usage: Usage | null
  lifehack: Lifehack | null
  pro: Pro | null
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
    retailPrice: number | null
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
