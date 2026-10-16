import { Link } from 'react-router-dom'
import { useCountUp } from '@/hooks/useCountUp'
import { CareList } from '@/components/about/CareList'
import { HOME_THESES, STATS, type Stat } from '@/components/about/care-data'
import { LABEL, LINK_MORE } from '@/components/about/classes'

function StatItem({ stat }: { stat: Stat }) {
  const { ref, value } = useCountUp(stat.value)

  return (
    <li>
      <div ref={ref}>
        <span
          aria-hidden="true"
          className="block font-heading font-bold tabular-nums leading-none tracking-[-0.015em] text-[2.5rem] md:text-[3.5rem] lg:text-[4rem]"
          style={{ minWidth: `${String(stat.value).length + 1}ch` }}
        >
          {value}+
        </span>
        <span aria-hidden="true" className={`mt-2 block ${LABEL} text-accent-foreground`}>
          {stat.label}
        </span>
        <span className="sr-only">
          {stat.value}+ {stat.label}
        </span>
      </div>
    </li>
  )
}

export function AboutHome() {
  return (
    <section id="about" aria-labelledby="about-home-title" className="bg-background py-12 md:py-16">
      <div className="container-app grid grid-cols-1 gap-y-8 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-8">
        <div className="lg:col-span-6 xl:col-span-5 lg:row-start-1">
          <p className={`${LABEL} text-primary`}>О компании</p>
          <h2 id="about-home-title" className="mt-3 text-h2 hyphens-auto [text-wrap:balance]">
            Пространство экспертной заботы о&nbsp;вашей коже
          </h2>
          <p className="mt-4 max-w-[46ch] text-body text-foreground [text-wrap:pretty]">
            Профессиональная косметика ISSEIMI и&nbsp;GLACÉE Skincare&nbsp;— и&nbsp;система заботы, которая
            помогает подобрать её правильно.
          </p>
        </div>

        <figure className="relative lg:col-start-7 lg:col-span-6 lg:row-start-1 lg:row-span-2 lg:self-start">
          <picture>
            <source
              type="image/webp"
              srcSet="/photos/m14-640.webp 640w, /photos/m14-1122.webp 1122w"
              sizes="(min-width:1280px) 610px, (min-width:1024px) 45vw, 100vw"
            />
            <img
              src="/photos/m14.png"
              width={1122}
              height={1402}
              loading="lazy"
              decoding="async"
              alt="Косметолог наносит маску кистью"
              className="w-full aspect-[4/5] md:aspect-[4/3] lg:aspect-[4/5] object-cover object-top rounded-media"
            />
          </picture>
          <div className="relative z-[1] -mt-12 ml-6 w-fit max-w-[calc(100%-1.5rem)] rounded-block bg-accent text-accent-foreground p-6 lg:absolute lg:mt-0 lg:ml-0 lg:-left-8 lg:bottom-8 lg:p-8 xl:-left-16">
            <ul role="list" className="grid grid-cols-2 gap-6 lg:gap-8">
              {STATS.map((stat) => (
                <StatItem key={stat.label} stat={stat} />
              ))}
            </ul>
          </div>
        </figure>

        <div className="lg:col-span-6 xl:col-span-5 lg:row-start-2">
          <CareList items={HOME_THESES} size="sm" />
          <Link to="/about" className={`mt-8 ${LINK_MORE}`}>
            Подробнее о компании
            <span
              aria-hidden="true"
              className="transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  )
}
