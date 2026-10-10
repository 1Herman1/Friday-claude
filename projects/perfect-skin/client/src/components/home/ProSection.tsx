import { useState } from 'react'
import { cardImage } from '@/lib/product-image'
import { splitName } from '@/lib/split-name'
import { Link } from 'react-router-dom'
import { useCatalogList } from '@/hooks/useCatalogList'
import type { CatalogFilters } from '@/hooks/useCatalogList'
import { useAuth, isApprovedPro } from '@/context/AuthContext'
import { useDrawer } from '@/context/DrawerContext'

const PRO_FILTERS: CatalogFilters = { pro: true, limit: 4, offset: 0 }

export function ProSection() {
  const { user } = useAuth()
  const { data, loading } = useCatalogList(PRO_FILTERS)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())
  const [active, setActive] = useState(0)
  const { openPro } = useDrawer()

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

  // Первыми — самые крупные фасовки: блок обещает «фасовки до 1000 мл».
  const products = [...(data?.items || [])].sort((a, b) => volumeMl(b) - volumeMl(a))
  const showList = products.length > 0 || loading

  return (
    <section id="pro" className="py-10 md:py-14 bg-background">
      <div className="container-app">
        <div className="bg-dark text-dark-foreground rounded-block p-6 md:p-12 xl:p-16 [container-type:inline-size]">
          <p className="text-label font-semibold uppercase tracking-wide text-accent mb-3 lg:text-body-sm">
            Для косметологов и салонов
          </p>
          <h2 className="font-heading font-bold uppercase text-dark-foreground text-[10.9cqi] leading-[0.9] tracking-tight whitespace-nowrap">
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
                  <>
                  <ProAccordion
                    products={products}
                    active={active}
                    onActivate={setActive}
                    onOpen={openPro}
                    imageErrors={imageErrors}
                    onImageError={(id) => setImageErrors((prev) => new Set([...prev, id]))}
                  />
                  <ul className="max-md:hidden">
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
                  </>
                )}
              </div>

              {/* Компьютер: одно окно с фото строки под курсором или в фокусе */}
              {!loading && products.length > 0 && (
                <div className="hidden xl:block xl:col-span-4 pt-12">
                  <div className="relative h-full min-h-[24rem] bg-card rounded-block overflow-hidden">
                    {products.map((product, i) => (
                      <div
                        key={product.id}
                        aria-hidden="true"
                        className={`absolute inset-0 p-4 flex items-center justify-center transition-opacity duration-200 motion-reduce:transition-none ${
                          i === active ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        {product.image && !imageErrors.has(product.id) ? (
                          <img
                            src={cardImage(product) ?? ''}
                            alt=""
                            className="w-full h-full object-contain scale-[1.6]"
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
            <div className="max-w-2xl">
              <p className="text-body text-dark-foreground/85 text-pretty">
                Оптовые цены на весь каталог и кабинетные фасовки до 1000 мл.
              </p>
              <p className="mt-2 text-body-sm text-dark-foreground/75 text-pretty">
                Нужны ИНН или ОГРНИП и фото сертификата косметолога. Вход по коду на email, без пароля.
              </p>
              <p className="mt-3 text-body-sm text-dark-foreground/75 text-pretty">
                Регистрация по email <span className="text-accent">→</span> заявка с ИНН и сертификатом{' '}
                <span className="text-accent">→</span> цены открываются в каталоге после проверки
              </p>
            </div>
            <button
              type="button"
              onClick={openPro}
              className="inline-flex shrink-0 items-center justify-center w-full md:w-auto bg-accent text-accent-foreground rounded-pill min-h-11 px-8 py-3 font-heading font-bold hover:bg-accent/90 transition-colors duration-200 focus-visible:outline-accent"
            >
              Подать заявку
            </button>
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

function volumeMl(product: ProProduct) {
  return parseFloat(volumeOf(product).replace(',', '.')) || 0
}

interface ProAccordionProps {
  products: ProProduct[]
  active: number
  onActivate: (i: number) => void
  onOpen: () => void
  imageErrors: Set<string>
  onImageError: (id: string) => void
}

// Телефон: ползунок и строка из четырёх товаров — выбранный раскрывается гармошкой
function ProAccordion({ products, active, onActivate, onOpen, imageErrors, onImageError }: ProAccordionProps) {
  if (products.length === 0) return null
  const current = splitName(products[active].name).title
  return (
    <div className="md:hidden pt-3">
      <div className="flex items-center justify-between">
        <label htmlFor="pro-pick" className="text-body-sm text-dark-foreground/75">
          Двигайте, чтобы выбрать
        </label>
        <span className="font-heading font-semibold text-body-sm text-accent tabular-nums" aria-hidden="true">
          {String(active + 1).padStart(2, '0')} / {String(products.length).padStart(2, '0')}
        </span>
      </div>
      <input
        id="pro-pick"
        type="range"
        min={0}
        max={products.length - 1}
        step={1}
        value={active}
        onChange={(e) => onActivate(Number(e.target.value))}
        aria-valuetext={current}
        className="block w-full h-11 cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-pill [&::-webkit-slider-runnable-track]:bg-dark-foreground/40 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:-mt-3 [&::-webkit-slider-thumb]:rounded-pill [&::-webkit-slider-thumb]:bg-accent [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-pill [&::-moz-range-track]:bg-dark-foreground/40 [&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-pill [&::-moz-range-thumb]:bg-accent"
      />
      <div className="flex gap-2 h-[26rem]">
        {products.map((product, i) => {
          const on = i === active
          const { title, desc } = splitName(product.name)
          const volume = volumeOf(product)
          return (
            <div
              key={product.id}
              onClick={() => onActivate(i)}
              aria-hidden={!on}
              className={`relative min-w-0 basis-0 rounded-block overflow-hidden text-foreground transition-[flex-grow,background-color] duration-300 ease-out motion-reduce:transition-none ${
                on ? 'grow-[8] bg-card' : 'grow cursor-pointer bg-muted'
              }`}
            >
              <div
                className={`absolute inset-x-0 top-0 flex items-center justify-center p-3 transition-[height] duration-300 ease-out motion-reduce:transition-none ${
                  on ? 'h-[52%]' : 'h-full'
                }`}
              >
                {product.image && !imageErrors.has(product.id) ? (
                  <img
                    src={cardImage(product) ?? ''}
                    alt=""
                    className={`h-full max-w-none object-contain mix-blend-multiply ${on ? 'w-full scale-[1.25] object-bottom' : 'w-[14rem] scale-[1.6]'}`}
                    loading="lazy"
                    decoding="async"
                    width={320}
                    height={320}
                    onError={() => onImageError(product.id)}
                  />
                ) : null}
              </div>
              {!on && (
                <span className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 font-heading font-semibold text-label text-muted-foreground tabular-nums">
                  {volume && <span className="[writing-mode:vertical-rl] rotate-180 uppercase tracking-wide">{volume}</span>}
                  {String(i + 1).padStart(2, '0')}
                </span>
              )}
              <div
                className={`absolute inset-x-0 bottom-0 w-[14.5rem] max-w-full p-4 flex flex-col gap-1 transition-opacity duration-200 motion-reduce:transition-none ${
                  on ? 'opacity-100 delay-150' : 'opacity-0 pointer-events-none'
                }`}
              >
                <span className="font-heading font-bold uppercase leading-tight text-body">{title}</span>
                {desc && <span className="text-body-sm text-muted-foreground line-clamp-2">{desc}</span>}
                <span className="text-label uppercase tracking-wide text-muted-foreground">
                  {product.brand?.name}
                  {volume && <span className="font-semibold text-foreground tabular-nums"> · {volume}</span>}
                </span>
                <button
                  type="button"
                  tabIndex={on ? 0 : -1}
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpen()
                  }}
                  className="mt-2 inline-flex items-center justify-center min-h-11 px-4 py-2.5 leading-tight text-balance rounded-pill bg-primary text-primary-foreground font-heading font-bold text-body-sm active:scale-97 transition-transform duration-160 focus-visible:outline-primary"
                >
                  Открыть оптовую цену
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
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
              className="w-full h-full object-contain scale-[1.3]"
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
            active ? 'xl:text-accent text-dark-foreground' : 'text-dark-foreground xl:text-dark-foreground/70'
          }`}
        >
          {title}
        </span>
        {desc && <span className="block mt-1 text-body-sm text-dark-foreground/70">{desc}</span>}
        {product.brand && (
          <span className="block mt-1 text-label uppercase tracking-wide text-dark-foreground/60">
            {product.brand.name}
            {volume && <span className="md:hidden text-dark-foreground/80 font-semibold tabular-nums"> · {volume}</span>}
          </span>
        )}
      </span>
      <span className="hidden md:block font-heading font-semibold text-body text-dark-foreground/80 tabular-nums whitespace-nowrap">
        {volume}
      </span>
    </li>
  )
}
