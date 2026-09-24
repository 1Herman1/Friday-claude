import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalogList } from '@/hooks/useCatalogList'
import type { CatalogFilters } from '@/hooks/useCatalogList'
import { useAuth, isApprovedPro } from '@/context/AuthContext'

const PRO_FILTERS: CatalogFilters = { pro: true, limit: 4, offset: 0 }

export function ProSection() {
  const { user } = useAuth()
  const { data, loading } = useCatalogList(PRO_FILTERS)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  if (isApprovedPro(user)) {
    return (
      <section id="pro" className="py-10 md:py-14 bg-background">
        <div className="container-app">
          <div className="bg-dark text-dark-foreground rounded-block px-6 md:px-12 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-body text-dark-foreground">
              Вы подтверждённый специалист — оптовые цены уже в каталоге.
            </p>
            <Link
              to="/catalog?pro=1"
              className="inline-flex items-center min-h-11 font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-accent"
            >
              Товары для кабинета →
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const products = data?.items || []
  const showRightColumn = products.length > 0 || loading

  return (
    <section id="pro" className="py-10 md:py-14 bg-background">
      <div className="container-app">
        <div className="bg-dark text-dark-foreground rounded-block p-6 md:p-12">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Left Column */}
            <div className="lg:col-span-5 flex flex-col">
              <p className="text-label font-semibold uppercase tracking-wide text-accent mb-3">
                Для косметологов и салонов
              </p>
              <h2 className="text-h2 font-heading font-bold text-dark-foreground mb-3">
                Специалистам
              </h2>
              <p className="text-body text-dark-foreground/85 max-w-prose mb-6">
                Оптовые цены на весь каталог и кабинетные фасовки до 1000 мл.
              </p>

              <Link
                to="/pro/register"
                className="inline-flex items-center justify-center w-full sm:w-auto bg-accent text-accent-foreground rounded-pill min-h-11 px-6 py-3 font-heading font-bold hover:bg-accent/90 transition-colors duration-200 focus-visible:outline-accent"
              >
                Подать заявку
              </Link>

              <p className="mt-3 text-body-sm text-dark-foreground/70">
                Нужен только ИНН или ОГРНИП — документы загружать не нужно. Вход по коду на email, без пароля.
              </p>

              <ol className="mt-8 flex flex-col gap-2 text-body-sm text-dark-foreground/70">
                <li className="flex gap-3">
                  <span className="text-accent font-semibold tabular-nums">01</span>
                  <span>Регистрация по email</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-accent font-semibold tabular-nums">02</span>
                  <span>Заявка с ИНН или ОГРНИП</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-accent font-semibold tabular-nums">03</span>
                  <span>Цены открываются в каталоге после проверки</span>
                </li>
              </ol>
            </div>

            {/* Right Column */}
            {showRightColumn && (
              <div className="lg:col-span-7">
                <p className="text-label font-semibold uppercase tracking-wide text-dark-foreground/70 mb-4">
                  Для кабинета · цены после проверки
                </p>

                {loading ? (
                  <div className="grid grid-cols-2 gap-4 md:gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex flex-col rounded-block border border-dark-foreground/15 bg-dark-foreground/5 p-5"
                      >
                        <div className="w-full aspect-square bg-dark-foreground/10 rounded-media mb-3 animate-pulse motion-reduce:animate-none" />
                        <div className="h-4 bg-dark-foreground/10 rounded mb-2 animate-pulse motion-reduce:animate-none w-3/4" />
                        <div className="h-4 bg-dark-foreground/10 rounded mb-3 animate-pulse motion-reduce:animate-none w-1/2" />
                        <div className="mt-auto h-5 bg-dark-foreground/10 rounded animate-pulse motion-reduce:animate-none w-2/3" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 md:gap-6">
                    {products.map((product) => {
                      const hasImageError = imageErrors.has(product.id)
                      const handleImageError = () => {
                        setImageErrors((prev) => new Set([...prev, product.id]))
                      }
                      const proVariant = product.variants?.find((v) => v.isProfessional)
                      const volumeLabel = proVariant?.volumeLabel || product.variants?.[0]?.volumeLabel

                      return (
                        <div
                          key={product.id}
                          className="flex flex-col rounded-block border border-dark-foreground/15 bg-dark-foreground/5 p-5"
                        >
                          {/* Image */}
                          <div className="w-full aspect-square rounded-media overflow-hidden mb-3">
                            {product.image && !hasImageError ? (
                              <div className="bg-card p-3 flex items-center justify-center w-full h-full">
                                <img
                                  src={`/products-optimized/${product.slug}/card.webp`}
                                  alt={product.name}
                                  className="w-full h-full object-contain"
                                  loading="lazy"
                                  decoding="async"
                                  width={256}
                                  height={256}
                                  onError={handleImageError}
                                />
                              </div>
                            ) : (
                              <div aria-hidden="true" className="bg-dark-foreground/5 border border-dark-foreground/15 flex flex-col items-center justify-center gap-2 w-full h-full">
                                {product.brand && (
                                  <span className="text-label font-semibold uppercase tracking-[0.08em] text-accent text-center px-2">
                                    {product.brand.name}
                                  </span>
                                )}
                                {volumeLabel && (
                                  <span className="font-heading font-semibold text-h3 text-dark-foreground/85">
                                    {volumeLabel}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Brand */}
                          {product.brand && product.image && !hasImageError && (
                            <p className="text-label text-dark-foreground/60 mb-1">
                              {product.brand.name}
                            </p>
                          )}

                          {/* Name */}
                          <p className="text-body-sm font-semibold text-dark-foreground line-clamp-2">
                            {product.name}
                          </p>

                          {/* Volume */}
                          {volumeLabel && product.image && !hasImageError && (
                            <p className="mt-auto pt-2 text-label font-semibold text-accent tabular-nums">
                              {volumeLabel}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
