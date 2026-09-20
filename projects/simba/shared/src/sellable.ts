/**
 * Правило продаваемости фасовки.
 * Фасовка продаваема, если цена положительная и есть остаток на складе.
 */
export interface Variant {
  price: number
  stock: number
}

/**
 * Проверить, продаётся ли фасовка по цене.
 */
export function isSellableByPrice(variant: Variant): boolean {
  return variant.price > 0
}

/**
 * Проверить, есть ли остаток на складе для запрошенного количества.
 */
export function hasStock(variant: Variant, quantity: number): boolean {
  return variant.stock >= quantity
}

/**
 * Проверить, продаваема ли фасовка целиком (цена и остаток).
 */
export function isSellable(variant: Variant, quantity: number = 1): boolean {
  return isSellableByPrice(variant) && hasStock(variant, quantity)
}
