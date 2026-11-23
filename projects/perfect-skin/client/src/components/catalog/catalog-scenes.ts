export const MOTION_TARGETS = ['all', 'kremy-dlya-litsa-i-shei'] as const
export type MotionTarget = typeof MOTION_TARGETS[number]
export interface CatalogScene {
  src: string
  productId: string
  /** Owner-approved current catalogue; see catalog-production-assets.json. */
  approval: string
}
export type CatalogSceneSets = Record<MotionTarget, readonly CatalogScene[]>

export const CATALOG_REVIEW = true
export const REVIEW_BESTSELLER_PRODUCT_ID = CATALOG_REVIEW ? '39a4bd4c-8468-4596-a079-d4a0023d74e7' : undefined
export const REVIEW_COVERS: Record<string, string> = CATALOG_REVIEW ? {
  'all': '/photos/catalog/review-all.webp',
  'kremy-dlya-litsa-i-shei': '/photos/catalog/review-kremy-dlya-litsa-i-shei.webp',
  'bestseller': '/photos/catalog/bestseller-tts-v2.png',
  'ochishchenie': '/photos/catalog/review-ochishchenie.webp',
  'maski': '/photos/catalog/review-maski.webp',
  'flyuidy': '/photos/catalog/review-flyuidy.webp',
  'toniki': '/photos/catalog/review-toniki.webp',
  'kremy-dlya-vek': '/photos/catalog/review-kremy-dlya-vek.webp',
  'masla': '/photos/catalog/review-masla.webp',
  'nabory': '/photos/catalog/review-nabory-v3.webp',
  'cream-night': '/photos/catalog/review-cream-night.webp',
  'unique-energel': '/photos/catalog/review-unique-energel.webp',
  'unique-sea-foam': '/photos/catalog/review-unique-sea-foam.webp',
  'unique-dinamizante': '/photos/catalog/review-unique-dinamizante.webp',
} : {}
const reviewScene = (cover: string, productId: string): CatalogScene => ({
  src: REVIEW_COVERS[cover], productId,
  approval: 'owner-publication-approved; catalog-production-assets.json',
})
export const CATALOG_SCENES: CatalogSceneSets = CATALOG_REVIEW ? {
  all: [
    reviewScene('all', '8ac18db0-7d28-4d43-a6a3-344818055aec'),
    reviewScene('unique-energel', 'b7385936-dee6-44a5-b79b-581a4151efbc'),
    reviewScene('unique-sea-foam', '360e10f2-955f-41a7-b01e-efabbe7bcde6'),
  ],
  'kremy-dlya-litsa-i-shei': [
    reviewScene('kremy-dlya-litsa-i-shei', '8c8a5eb7-06fb-4572-b0be-9da41efa204b'),
    reviewScene('cream-night', '967b68c5-7dac-45e7-b460-b29024e81c80'),
    reviewScene('unique-dinamizante', '8c51ff73-d629-408e-bea3-89eb491c94eb'),
  ],
} : { all: [], 'kremy-dlya-litsa-i-shei': [] }

export function approvedSequences(sets: CatalogSceneSets): Partial<CatalogSceneSets> {
  const result: Partial<CatalogSceneSets> = {}
  for (const target of MOTION_TARGETS) {
    const scenes = sets[target]
    if (scenes.length >= 2 && scenes.length <= 3
      && new Set(scenes.map(scene => scene.src)).size === scenes.length
      && new Set(scenes.map(scene => scene.productId)).size === scenes.length
      && scenes.every(scene => scene.src.startsWith('/photos/catalog/') && scene.productId.trim() && scene.approval.trim())) result[target] = scenes
  }
  return result
}
export const CATALOG_SEQUENCES = approvedSequences(CATALOG_SCENES)
