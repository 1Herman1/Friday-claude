// Фото, загруженное в админке, лежит в /uploads/ и у него нет нарезки в products-optimized.
export function isUploadedImage(src: string | null | undefined): boolean {
  return !!src && src.startsWith('/uploads/')
}

export function cardImage(product: { slug: string; image: string | null }): string | null {
  if (!product.image) return null
  return isUploadedImage(product.image) ? product.image : `/products-optimized/${product.slug}/card.webp`
}
