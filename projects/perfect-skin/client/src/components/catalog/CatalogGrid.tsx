import { Link } from 'react-router-dom'
import type { CategoriesTreeResponse } from '@/types/api'

interface CatalogGridProps {
  categories: CategoriesTreeResponse[]
}

export function CatalogGrid({ categories }: CatalogGridProps) {
  // First category is "all" (largest)
  const firstCategory = categories[0]
  const restCategories = categories.slice(1)

  return (
    <div className="space-y-8">
      {/* "All" category - largest */}
      {firstCategory && (
        <Link
          to={`/catalog/all`}
          className="block bg-card rounded-block overflow-hidden transition-transform duration-200 hover:-translate-y-1"
        >
          <div className="aspect-video bg-accent flex items-center justify-center group">
            <div className="text-center">
              <h2 className="text-heading font-heading font-bold text-primary-foreground text-4xl mb-2 group-hover:-translate-y-1 transition-transform duration-200">
                Все средства
              </h2>
              <p className="text-primary-foreground text-lg opacity-90">{firstCategory.productCount} товаров</p>
            </div>
          </div>
        </Link>
      )}

      {/* Rest categories - grid 2x3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {restCategories.map(category => (
          <Link
            key={category.slug}
            to={`/catalog/${category.slug}`}
            className="group bg-card rounded-block overflow-hidden transition-transform duration-200 hover:-translate-y-1"
          >
            <div className="aspect-square bg-card flex items-center justify-center relative overflow-hidden">
              {category.image ? (
                <img
                  src={category.image}
                  alt={category.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <span className="text-muted-foreground text-sm">Нет изображения</span>
                </div>
              )}
            </div>
            <div className="p-2">
              <h3 className="font-sans font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                {category.name}
              </h3>
              <p className="text-sm text-muted-foreground">{category.productCount} товаров</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
