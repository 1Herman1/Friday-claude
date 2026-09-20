import { Link } from 'react-router-dom'
import { useCatalogList } from '@/hooks/useCatalogList'
import type { CatalogFilters } from '@/hooks/useCatalogList'
import { useAuth, isApprovedPro } from '@/context/AuthContext'

// Константа вне компонента: новый объект на каждом рендере заставлял хук
// перезапрашивать каталог бесконечно.
const PRO_FILTERS: CatalogFilters = { pro: true, limit: 3, offset: 0 }

export function ProSection() {
  const { user } = useAuth()
  const { data, loading } = useCatalogList(PRO_FILTERS)

  // Если пользователь уже одобрен как профессионал
  if (isApprovedPro(user)) {
    return (
      <section
        id="pro"
        className="py-10 md:py-14 bg-background"
      >
        <div className="container-app">
          <div className="bg-dark text-dark-foreground rounded-block p-6 md:p-12 lg:p-16">
            <h2 className="text-h2 font-heading font-bold mb-3 text-dark-foreground">
              Вы специалист
            </h2>
            <p className="text-body text-dark-foreground/85 mb-8 max-w-prose">
              Оптовые цены уже показаны в каталоге
            </p>
            <Link
              to="/catalog?pro=1"
              className="text-accent underline-offset-4 hover:underline font-semibold transition-colors duration-200 focus-visible:outline-ring"
            >
              Товары для кабинета →
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const products = data?.items || []

  return (
    <section
      id="pro"
      className="py-10 md:py-14 bg-background"
    >
      <div className="container-app">
        <div className="bg-dark text-dark-foreground rounded-block p-6 md:p-12 lg:p-16">
          {/* Header */}
          <h2 className="text-h2 font-heading font-bold mb-3 text-dark-foreground">
            Специалистам
          </h2>
          <p className="text-body text-dark-foreground/85 max-w-prose mb-8">
            Оптовые цены на весь каталог и профессиональные фасовки для кабинета. Доступ открывается после подтверждения статуса — проверка занимает один рабочий день.
          </p>

          {/* Three Steps */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="flex flex-col">
              <span className="text-label font-semibold text-accent mb-2">01</span>
              <h3 className="font-heading font-semibold text-dark-foreground mb-2">
                Регистрация
              </h3>
              <p className="text-body-sm text-dark-foreground/70">
                Email и код — без пароля
              </p>
            </div>

            <div className="flex flex-col">
              <span className="text-label font-semibold text-accent mb-2">02</span>
              <h3 className="font-heading font-semibold text-dark-foreground mb-2">
                Заявка
              </h3>
              <p className="text-body-sm text-dark-foreground/70">
                ИНН или ОГРНИП, салон, специализация. Документы загружать не нужно
              </p>
            </div>

            <div className="flex flex-col">
              <span className="text-label font-semibold text-accent mb-2">03</span>
              <h3 className="font-heading font-semibold text-dark-foreground mb-2">
                Доступ
              </h3>
              <p className="text-body-sm text-dark-foreground/70">
                После проверки в каталоге открываются профессиональные цены
              </p>
            </div>
          </div>

          {/* Conditions Table */}
          <div className="grid md:grid-cols-2 gap-x-8 mb-12">
            <div className="flex justify-between items-baseline gap-4 py-4 border-t border-dark-foreground/15 text-body-sm">
              <span>Профессиональные фасовки</span>
              <b className="text-accent font-semibold tabular-nums whitespace-nowrap">
                до 1000 мл
              </b>
            </div>

            <div className="flex justify-between items-baseline gap-4 py-4 border-t border-dark-foreground/15 text-body-sm">
              <span>Бесплатная доставка СДЭК в ПВЗ</span>
              <b className="text-accent font-semibold tabular-nums whitespace-nowrap">
                от 6 000 ₽
              </b>
            </div>

            <div className="flex justify-between items-baseline gap-4 py-4 border-t border-dark-foreground/15 text-body-sm">
              <span>Курьером</span>
              <b className="text-accent font-semibold tabular-nums whitespace-nowrap">
                от 10 000 ₽
              </b>
            </div>

            <div className="flex justify-between items-baseline gap-4 py-4 border-t border-dark-foreground/15 text-body-sm">
              <span>Производитель — Heber Farma, Испания</span>
              <b className="text-accent font-semibold tabular-nums whitespace-nowrap">
                с 2017 года
              </b>
            </div>
          </div>

          {/* Product Lines Chips */}
          <ul className="flex flex-wrap gap-2 mb-12">
            <li className="px-3 py-1.5 rounded-pill border border-dark-foreground/25 text-label font-semibold text-dark-foreground">
              ISSEIMI Base
            </li>
            <li className="px-3 py-1.5 rounded-pill border border-dark-foreground/25 text-label font-semibold text-dark-foreground">
              ISSEIMI MD
            </li>
            <li className="px-3 py-1.5 rounded-pill border border-dark-foreground/25 text-label font-semibold text-dark-foreground">
              ISSEIMI Nat Collection
            </li>
            <li className="px-3 py-1.5 rounded-pill border border-dark-foreground/25 text-label font-semibold text-dark-foreground">
              GLACÉE Skincare
            </li>
          </ul>

          {/* Products Grid */}
          <h3 className="text-h3 font-heading font-bold text-dark-foreground mb-6">
            Примеры товаров для закупки
          </h3>

          {loading ? (
            // Skeletons
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col rounded-block border border-dark-foreground/15 bg-dark-foreground/5 p-4 min-h-80"
                >
                  <div className="w-full aspect-square bg-dark-foreground/10 rounded-media mb-4 animate-pulse" />
                  <div className="h-4 bg-dark-foreground/10 rounded mb-3 animate-pulse w-3/4" />
                  <div className="h-4 bg-dark-foreground/10 rounded mb-6 animate-pulse w-1/2" />
                  <div className="h-6 bg-dark-foreground/10 rounded mt-auto animate-pulse" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            // No products, CTA only
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-md">
              <div className="bg-accent text-accent-foreground rounded-block p-6 flex flex-col justify-end col-span-1 sm:col-span-2 lg:col-span-4 lg:max-w-md">
                <h4 className="font-heading font-bold text-lg lg:text-xl uppercase mb-2 text-accent-foreground">
                  Стать специалистом
                </h4>
                <p className="text-body-sm mb-4 text-accent-foreground/90">
                  Проверка — один рабочий день
                </p>
                <Link
                  to="/pro/register"
                  className="bg-primary text-primary-foreground rounded-pill px-6 py-3 min-h-11 font-heading font-bold self-start hover:bg-primary/90 transition-colors duration-200 focus-visible:outline-ring"
                >
                  Подать заявку
                </Link>
              </div>
            </div>
          ) : (
            // Products + CTA
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {products.map((product, i) => (
                <div
                  key={product.id}
                  className="flex flex-col rounded-block border border-dark-foreground/15 bg-dark-foreground/5 p-4 hover:bg-dark-foreground/10 transition-colors duration-200"
                >
                  <div className="w-full aspect-square bg-background rounded-media object-contain p-4 mb-4 flex items-center justify-center overflow-hidden">
                    <img
                      src={`/products-optimized/${product.slug}/card.webp`}
                      alt={product.name}
                      className="w-full h-full object-contain"
                      loading={i < 2 ? 'eager' : 'lazy'}
                    />
                  </div>
                  <h4 className="font-semibold text-dark-foreground mb-2 text-body-sm line-clamp-2">
                    <Link to={`/product/${product.slug}`} className="focus-visible:outline-ring hover:underline underline-offset-4">
                      {product.name}
                    </Link>
                  </h4>
                  <p className="text-label text-dark-foreground/70 mb-4">
                    {
                      product.variants?.find((v) => v.isProfessional)
                        ?.volumeLabel || product.variants?.[0]?.volumeLabel
                    }
                  </p>
                  <div className="mt-auto">
                    <span className="text-sm text-dark-foreground/80">Цена для специалистов</span>
                    <Link to="/pro" className="block text-sm font-semibold text-accent hover:underline underline-offset-4 focus-visible:outline-ring">
                      Получить доступ →
                    </Link>
                  </div>
                </div>
              ))}

              {/* CTA Tile */}
              <div className="bg-accent text-accent-foreground rounded-block p-6 flex flex-col justify-end">
                <h4 className="font-heading font-bold text-lg lg:text-xl uppercase mb-2 text-accent-foreground">
                  Стать специалистом
                </h4>
                <p className="text-body-sm mb-4 text-accent-foreground/90">
                  Проверка — один рабочий день
                </p>
                <Link
                  to="/pro/register"
                  className="bg-primary text-primary-foreground rounded-pill px-6 py-3 min-h-11 font-heading font-bold self-start hover:bg-primary/90 transition-colors duration-200 focus-visible:outline-ring"
                >
                  Подать заявку
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
