import { useState } from 'react'
import { cardImage } from '@/lib/product-image'
import { Link } from 'react-router-dom'
import { useCatalogList } from '@/hooks/useCatalogList'
import type { CatalogFilters } from '@/hooks/useCatalogList'
import { useAuth, isApprovedPro } from '@/context/AuthContext'

const PRO_FILTERS: CatalogFilters = { pro: true, limit: 4, offset: 0 }

export function ProSection() {
  const { user } = useAuth()
  const { data, loading } = useCatalogList(PRO_FILTERS)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())
  const [active, setActive] = useState(0)

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
  const showList = products.length > 0 || loading

  return (
    <section id="pro" className="py-10 md:py-14 bg-background">
      <div className="container-app">
        <div className="bg-dark text-dark-foreground rounded-block p-6 md:p-12 xl:p-16">
          <p className="text-label font-semibold uppercase tracking-wide text-accent mb-3 lg:text-body-sm">
            Для косметологов и салонов
          </p>
          <h2 className="font-heading font-bold uppercase text-dark-foreground text-[clamp(1.75rem,7.4vw,7rem)] leading-[0.9] tracking-tight whitespace-nowrap">
            Специалистам
          </h2>

          {showList && (
            <div className="mt-8 md:mt-12 border-t border-dark-foreground/15 xl:grid xl:grid-cols-12 xl:gap-12">
              <div className="xl:col-span-8">
                <p className="pt-4 text-label font-semibold uppercase tracking-wide text-dark-foreground/60">
                  Для кабинета · цены после проверки
                </p>
                {loading ? (
                  <ul aria-busy="true">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <li key={i} className="py-5 border-b border-dark-foreground/15">
                        <div className="h-7 w-2/3 bg-dark-foreground/10 rounded animate-pulse motion-reduce:animate-none" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul>
                    {products.map((product, i) => (
                      <IndexRow
                        key={product.id}
                        index={i}
                        product={product}
                        active={i === active}
                        onActivate={() => setActive(i)}
                        imageFailed={imageErrors.has(product.id)}
                        onImageError={() => setImageErrors((prev) => new Set([...prev, product.id]))}
                      />
                    ))}
                  </ul>
                )}
              </div>

              {/* Компьютер: одно окно с фото строки под курсором или в фокусе */}
              {!loading && products.length > 0 && (
                <div className="hidden xl:block xl:col-span-4 pt-12">
                  <div className="sticky top-28 aspect-[4/5] bg-card rounded-block overflow-hidden">
                    {products.map((product, i) => (
                      <div
                        key={product.id}
                        aria-hidden="true"
                        className={`absolute inset-0 p-8 flex items-center justify-center transition-opacity duration-200 motion-reduce:transition-none ${
                          i === active ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        {product.image && !imageErrors.has(product.id) ? (
                          <img
                            src={cardImage(product) ?? ''}
                            alt=""
                            className="w-full h-full object-contain"
                            loading="lazy"
                            decoding="async"
                            width={480}
                            height={600}
                          />
                        ) : (
                          <span className="font-heading font-bold text-h2 text-dark/30">{volumeOf(product)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-10 md:mt-14 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <p className="text-body text-dark-foreground/85">
                Оптовые цены на весь каталог и кабинетные фасовки до 1000 мл.
              </p>
              <p className="mt-2 text-body-sm text-dark-foreground/70">
                Нужны ИНН или ОГРНИП и фото сертификата косметолога. Вход по коду на email, без пароля.
              </p>
              <p className="mt-3 text-body-sm text-dark-foreground/60">
                Регистрация по email <span className="text-accent">→</span> заявка с ИНН и сертификатом{' '}
                <span className="text-accent">→</span> цены открываются в каталоге после проверки
              </p>
            </div>
            <Link
              to="/pro/register"
              className="inline-flex shrink-0 items-center justify-center w-full md:w-auto bg-accent text-accent-foreground rounded-pill min-h-11 px-8 py-3 font-heading font-bold hover:bg-accent/90 transition-colors duration-200 focus-visible:outline-accent"
            >
              Подать заявку
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

type ProProduct = NonNullable<ReturnType<typeof useCatalogList>['data']>['items'][number]

function volumeOf(product: ProProduct) {
  const proVariant = product.variants?.find((v) => v.isProfessional)
  return proVariant?.volumeLabel || product.variants?.[0]?.volumeLabel || ''
}

// «FLUVIX Сыворотка обновляющая» → латинское имя крупно, русское описание под ним.
function splitName(name: string) {
  const m = name.match(/^([^А-Яа-яЁё]+?)\s+([А-Яа-яЁё].*)$/)
  return m ? { title: m[1], desc: m[2] } : { title: name, desc: '' }
}

interface IndexRowProps {
  index: number
  product: ProProduct
  active: boolean
  onActivate: () => void
  imageFailed: boolean
  onImageError: () => void
}

function IndexRow({ index, product, active, onActivate, imageFailed, onImageError }: IndexRowProps) {
  const { title, desc } = splitName(product.name)
  const volume = volumeOf(product)
  return (
    <li
      tabIndex={0}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      className="group grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto] items-center gap-4 md:gap-6 py-4 md:py-5 min-h-11 border-b border-dark-foreground/15 outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm cursor-default"
    >
      <span className="flex items-center gap-3 md:gap-5">
        <span className="font-heading font-semibold text-body-sm md:text-body text-accent tabular-nums w-6">
          {String(index + 1).padStart(2, '0')}
        </span>
        {/* Телефон и планшет: маленькое фото в строке */}
        <span className="xl:hidden block w-16 h-16 md:w-20 md:h-20 shrink-0 bg-card rounded-media overflow-hidden p-1.5">
          {product.image && !imageFailed ? (
            <img
              src={cardImage(product) ?? ''}
              alt=""
              className="w-full h-full object-contain"
              loading="lazy"
              decoding="async"
              width={80}
              height={80}
              onError={onImageError}
            />
          ) : null}
        </span>
      </span>
      <span className="min-w-0">
        <span
          className={`block font-heading font-bold uppercase leading-tight text-[clamp(1.05rem,2.2vw,2.1rem)] transition-colors duration-200 ${
            active ? 'xl:text-accent text-dark-foreground' : 'text-dark-foreground xl:text-dark-foreground/55'
          }`}
        >
          {title}
        </span>
        {desc && <span className="block mt-1 text-body-sm text-dark-foreground/70">{desc}</span>}
        {product.brand && (
          <span className="block mt-1 text-label uppercase tracking-wide text-dark-foreground/50">
            {product.brand.name}
            {volume && <span className="md:hidden text-accent font-semibold tabular-nums"> · {volume}</span>}
          </span>
        )}
      </span>
      <span className="hidden md:block font-heading font-semibold text-body text-accent tabular-nums whitespace-nowrap">
        {volume}
      </span>
    </li>
  )
}
