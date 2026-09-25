import { Link } from 'react-router-dom'
import { useCountUp } from '@/hooks/useCountUp'

function CountUpItem({
  target,
  label,
}: {
  target: number
  label: string
}) {
  const { ref, value } = useCountUp(target)

  return (
    <div>
      <div
        ref={ref}
        className="text-display font-heading font-bold tabular-nums text-foreground"
      >
        <span aria-hidden="true">{value}+</span>
        <span className="sr-only">{target}+ {label}</span>
      </div>
      <p className="text-body-sm text-muted-foreground mt-2">{label}</p>
    </div>
  )
}

export function About({ variant = 'home' }: { variant?: 'home' | 'page' }) {
  return (
    <section id="about" className="bg-background py-10 md:py-14">
      <div className="container-app">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-7">
            {variant === 'home' && (
              <h2 className="text-h2 font-heading font-bold mb-4">О компании</h2>
            )}
            <p className={`${variant === 'page' ? 'text-h3 font-heading font-semibold' : 'text-body'} text-foreground max-w-prose`}>
              Продаём испанскую фармацевтическую косметику ISSEIMI и GLACÉE Skincare — для домашнего ухода и косметологических кабинетов.
            </p>
            <div className="grid grid-cols-2 gap-6 max-w-md mt-8">
              <CountUpItem target={30} label="Лет исследований" />
              <CountUpItem target={9} label="Лет на рынке" />
            </div>
            {variant === 'home' && (
              <Link
                to="/about"
                className="mt-3 inline-flex items-center gap-1 min-h-11 text-body-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-ring"
              >
                Подробнее о компании <span aria-hidden>→</span>
              </Link>
            )}
          </div>

          <div className="lg:col-span-5">
            <dl className="divide-y divide-border border-t border-b border-border">
              <div className="py-4">
                <dt className="text-label font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Производитель
                </dt>
                <dd className="mt-1 text-body font-heading font-semibold text-foreground">
                  Heber Farma, Испания
                </dd>
              </div>
              <div className="py-4">
                <dt className="text-label font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Поставщик
                </dt>
                <dd className="mt-1 text-body font-heading font-semibold text-foreground">
                  Официальный дистрибьютор в России, с 2017 года
                </dd>
              </div>
              <div className="py-4">
                <dt className="text-label font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Продавец
                </dt>
                <dd className="mt-1 text-body font-heading font-semibold text-foreground">
                  ИП Рыбко А. А., Москва
                  <span className="block mt-1 text-body-sm font-sans font-normal text-muted-foreground">
                    Звенигородское шоссе, 3Ас1 · самовывоз бесплатно
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}
