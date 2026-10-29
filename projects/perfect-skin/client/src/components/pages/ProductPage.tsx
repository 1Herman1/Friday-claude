import { useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { NotFoundPage } from './NotFoundPage'
import { ProductDetail } from '@/components/product/ProductDetail'
import { useProductDetail } from '@/hooks/useProductDetail'
import { useFavorites } from '@/context/FavoritesContext'
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, metaForProduct } from '@ps/shared'
import { usePageMeta } from '@/hooks/usePageMeta'

export function ProductPage() {
  const { slug } = useParams()
  const { data: product, loading, error, loadedSlug } = useProductDetail(slug)
  const navigate = useNavigate()
  const location = useLocation()
  const { rename } = useFavorites()
  const seo = product
    ? metaForProduct(
        {
          name: product.name,
          slug: product.slug,
          brandName: product.brand?.name ?? null,
          seoTitle: product.seo.title,
          seoDescription: product.seo.description,
        },
        product.priceHidden ? null : product.minPrice,
      )
    : null
  usePageMeta({
    title: seo?.title ?? DEFAULT_TITLE,
    description: seo?.description ?? DEFAULT_DESCRIPTION,
    path: seo?.canonicalPath ?? location.pathname,
  })

  // Открыт старый адрес товара: сервер отдал карточку с новым slug — меняем адрес и запись в избранном
  useEffect(() => {
    if (!product || !slug || loadedSlug !== slug || product.slug === slug) return
    rename(slug, product.slug)
    navigate(`/product/${product.slug}${location.search}${location.hash}`, { replace: true })
  }, [product, slug, loadedSlug, rename, navigate, location.search, location.hash])

  if (error?.code === 'PRODUCT_NOT_FOUND') {
    return <NotFoundPage />
  }

  return (
    <ProductDetail
      product={product!}
      loading={loading}
      error={error}
    />
  )
}
