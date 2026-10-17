import { CareList } from '@/components/about/CareList'
import { CompanyRoles } from '@/components/about/CompanyRoles'
import { CARE_STEPS, STATS } from '@/components/about/care-data'
import { LABEL } from '@/components/about/classes'

const RAIL_GRID = 'grid grid-cols-1 gap-y-6 md:grid-cols-12 md:gap-x-8 md:gap-y-8'
const BODY_COL = 'md:col-start-5 md:col-span-8 xl:col-start-6 xl:col-span-7'

export function AboutPage() {
  return (
    <div className="bg-background">
      <div className="container-app space-y-16 pt-12 pb-16 md:pt-16 lg:space-y-24 lg:pb-24">
        <header className={RAIL_GRID}>
          <h1 className="max-w-[20ch] text-display hyphens-auto md:col-span-12 [text-wrap:balance]">
            Perfect&nbsp;Skin — пространство экспертной заботы о&nbsp;вашей коже
          </h1>
          <p className={`${BODY_COL} max-w-prose text-lead text-foreground [text-wrap:pretty]`}>
            Мы — команда единомышленников, которая верит: красота кожи начинается с глубокого понимания её
            потребностей. Сегодня мы представляем два бренда профессиональной косметики — ISSEIMI и&nbsp;GLACÉE
            Skincare. В будущем коллекция пополнится и другими марками, но уже сейчас мы готовы предложить
            средства, которые работают на результат.
          </p>
        </header>

        <section aria-label="Факты о компании" className={RAIL_GRID}>
          <ul role="list" className="grid grid-cols-2 gap-8 md:col-span-4 md:grid-cols-1">
            {STATS.map((stat) => (
              <li key={stat.label}>
                <span className="block font-heading font-bold tabular-nums leading-none text-[2.5rem] text-foreground lg:text-[3.5rem]">
                  {stat.value}+
                </span>
                <span className={`mt-2 block ${LABEL} text-muted-foreground`}>{stat.label}</span>
              </li>
            ))}
          </ul>
          <div className={BODY_COL}>
            <CompanyRoles />
          </div>
        </section>

        <section aria-labelledby="about-expertise-title" className={RAIL_GRID}>
          <h2 id="about-expertise-title" className="text-h3 md:col-span-4 [text-wrap:balance]">
            Почему важен экспертный подход
          </h2>
          <div className={`${BODY_COL} space-y-8`}>
            <p className="max-w-prose text-body text-foreground">
              Профессиональная косметика — это не просто приятные текстуры и ароматы. Это концентрированные
              формулы, и подбирать их нужно правильно: ошибка в выборе может не дать результата или не подойти
              вашей коже.
            </p>
            <picture className="block">
              <source
                type="image/webp"
                srcSet="/photos/m16-640.webp 640w, /photos/m16-1254.webp 1254w"
                sizes="(min-width:1280px) 715px, (min-width:768px) 62vw, 100vw"
              />
              <img
                src="/photos/m16.png"
                width={1254}
                height={1254}
                loading="lazy"
                decoding="async"
                alt="Открытая баночка крема ISSEIMI Advance Repair"
                className="w-full aspect-[4/3] object-cover rounded-media"
              />
            </picture>
          </div>
        </section>

        <section aria-labelledby="about-care-title" className={`${RAIL_GRID} md:grid-rows-[auto_1fr]`}>
          <h2 id="about-care-title" className="text-h3 md:col-span-4 md:row-start-1 [text-wrap:balance]">
            Система заботы
          </h2>
          <div className={`${BODY_COL} space-y-8 md:row-start-1 md:row-span-2`}>
            <p className="max-w-prose text-lead text-foreground">
              Чтобы уход подходил именно вашей коже, мы выстроили систему заботы из четырёх частей.
            </p>
            <CareList items={CARE_STEPS} size="md" />
          </div>
          <figure className="md:col-span-4 md:row-start-2 md:self-start">
            <picture>
              <source
                type="image/webp"
                srcSet="/photos/m5-640.webp 640w, /photos/m5-1122.webp 1122w"
                sizes="(min-width:768px) 400px, 100vw"
              />
              <img
                src="/photos/m5.png"
                width={1122}
                height={1402}
                loading="lazy"
                decoding="async"
                alt="Два крема ISSEIMI в руках"
                className="w-full aspect-[4/3] object-cover object-[50%_30%] rounded-media md:aspect-[4/5] md:object-center"
              />
            </picture>
          </figure>
        </section>

        <p className="mx-auto max-w-[28ch] text-center font-heading font-semibold text-h3 text-foreground [text-wrap:balance]">
          Добро пожаловать в&nbsp;Perfect&nbsp;Skin. Доверьте свою кожу профессионалам.
        </p>
      </div>
    </div>
  )
}
