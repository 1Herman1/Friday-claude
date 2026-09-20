import { useParams } from 'react-router-dom'
import { NotFoundPage } from './NotFoundPage'
import { ProductDetail } from '@/components/product/ProductDetail'
import { useProductDetail } from '@/hooks/useProductDetail'

export function ProductPage() {
  const { slug } = useParams()
  const { data: product, loading, error } = useProductDetail(slug)

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
