export type MsAssortmentItem = {
  id: string
  meta: { type: string }
  name: string
  article?: string
  code?: string
  archived?: boolean
  pathName?: string
  product?: { meta?: { href?: string } }
  salePrices?: Array<{
    value: number
    priceType?: { name?: string }
  }>
}

export type MsStockRow = {
  assortmentId: string
  stock: number
}

export type MsAssortmentResponse = {
  rows: MsAssortmentItem[]
  meta: { limit: number; offset: number; total: number }
}

export type MsStockResponse = {
  rows: MsStockRow[]
}

/** Базовая сущность МойСклада (организация, склад, товар и т.д.) */
export type MsEntity = {
  id: string
  name?: string
  meta?: {
    type: string
    href?: string
  }
}

/** Позиция в документе (приёмка, возврат) */
export type MsDocumentPosition = {
  quantity: number
  price: number
  assortment: MsEntity
}

/** Документ приёмки/возврата */
export type MsDocument = {
  id: string
  name?: string
  meta: {
    type: string
    href?: string
  }
  description?: string
  organization?: MsEntity
  store?: MsEntity
  positions?: MsDocumentPosition[]
  created?: string
  updated?: string
}

/** Ответ на создание документа */
export type MsDocumentResponse = MsDocument & {
  id: string
  meta: {
    type: string
    href: string
  }
}
