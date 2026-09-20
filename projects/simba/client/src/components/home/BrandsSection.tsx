import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useReveal } from '../../hooks/useReveal'
import { useSiteText } from '../../context/SiteTextsContext'
import { brandsApi, type Brand } from '../../lib/api'

/** Группа логотипа по пропорции (ширина/высота) нормализованного файла.
    Логотипы расходятся по форме вчетверо — от квадратного знака Zillii (0.94)
    до широкой надписи AlphaPet (3.57). При общем ограничении по высоте
    квадратные знаки читались бы вдвое мельче надписей, поэтому у каждой группы
    свой бокс: его пропорция — геометрическое среднее внутри группы, тогда
    площадь у всех совпадает, а не габарит.

    Пороги: ≥ 2.6 — wide, 1.6…2.6 — mid, < 1.6 — mark (геометрические середины
    между группами). Классификация читается из logoFit в БД, а не из захардкода. */
type LogoGroup = 'wide' | 'mid' | 'mark'

/** Литеральные строки, а не сборка через шаблон: JIT-сканер Tailwind видит
    только целые классы в исходнике — собранные динамически молча не попадут
    в сборку, и логотипы уедут в дефолтный размер.
    Фиксированный бокс (w+h), а не max-h: размер известен до загрузки файла,
    поэтому внутри плитки нет сдвига при lazy-загрузке.
    Группа mark на 5-10% крупнее прочих намеренно: квадратный знак при равной
    площади читается легче горизонтальной надписи. */
/* Владелец выбрал размер по живому макету: 85% высоты плитки для всех групп,
   боковой отступ держит max-w — логотип крупный, но не касается краёв. */
const LOGO_SIZE: Record<LogoGroup, string> = {
  wide: 'h-[85%] w-auto max-w-[86%] object-contain',
  mid: 'h-[85%] w-auto max-w-[86%] object-contain',
  mark: 'h-[85%] w-auto max-w-[86%] object-contain',
}

function logoSrc(brand: Brand): string | null {
  if (brand.logo) return brand.logo
  return `/brands/${brand.slug}.png`
}

/** Плитка бренда — ссылка в каталог этого бренда.
    Логотип и название живут в одной полосе по высоте (40px, на lg — 48px):
    оптический вес выравнивается геометрией, поэтому смешанный ряд
    «часть с логотипами, часть с названиями» читается цельно, а не сломанно.
    Если у бренда есть accentColor, плитка заливается им, а картинка кладётся
    на белую подложку — так буквы (с альфой 0) видны через прозрачные дыры. */
function BrandTileLink({ brand }: { brand: Brand }) {
  const [failed, setFailed] = useState(false)
  const src = logoSrc(brand)
  const showLogo = src !== null && !failed
  const logoFit = (brand.logoFit ?? 'mid') as LogoGroup

  return (
    <Link
      to={`/catalog?brand=${brand.slug}`}
      aria-label={`${brand.name} — товары бренда`}
      className={`brand-card flex h-20 w-full items-center justify-center overflow-hidden rounded-card sm:h-24 lg:h-28 ${
        brand.accentColor ? 'border-0' : 'border border-line bg-white p-3 lg:p-4'
      }`}
      style={brand.accentColor ? { backgroundColor: brand.accentColor } : undefined}
    >
      {showLogo ? (
        brand.accentColor ? (
          /* Логотип занимает плитку целиком, а белая подложка лежит ПОД НИМ
             ровно по его размеру. Тогда белое видно только сквозь прозрачные
             буквы (у farmina.png они с альфой 0), а фирменный синий картинки
             стыкуется с таким же синим плитки — шва нет.
             Отдельная белая коробка внутри цветной рамки, как было сначала,
             давала ровно то, чего просили избежать: две видимые границы. */
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            /* 72% плитки — примерка владельца. Раньше это был transform: scale,
               и на трёх колонках телефона края логотипа резались рамкой плитки;
               теперь размер задан боксом, картинка всегда вписана. */
            className="h-[72%] aspect-square bg-white object-contain"
          />
        ) : (
        <div className="flex items-center justify-center w-full h-full">
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className={LOGO_SIZE[logoFit]}
          />
        </div>
        )
      ) : (
        <span
          className={`text-balance break-words text-center text-base font-extrabold leading-tight tracking-tight lg:text-lg ${
            brand.accentColor ? 'text-white' : 'text-navy-800'
          }`}
        >
          {brand.name}
        </span>
      )}
    </Link>
  )
}

/** Каскад по 45мс с потолком на 6-й плитке: в сетке 6 колонок это ровно первый
    ряд, второй въезжает целиком следом. */
const revealDelay = (i: number) => `${60 + Math.min(i, 5) * 45}ms`

export default function BrandsSection() {
  const groupRef = useReveal<HTMLDivElement>()
  const [brands, setBrands] = useState<Brand[]>([])
  const brandsTitle = useSiteText('home.brands.title', 'Бренды, которым мы доверяем')
  const brandsSubtitle = useSiteText('home.brands.subtitle', 'Все бренды, что есть в наличии. Нажмите на любой — откроется его каталог.')

  useEffect(() => {
    brandsApi
      .list()
      .then((res) =>
        setBrands(res.data.slice().sort((a, b) => b.productCount - a.productCount)),
      )
      .catch(() => setBrands([]))
  }, [])

  if (brands.length === 0) return null

  return (
    <section id="brands" className="scroll-mt-24 py-12 md:py-16">
      <div ref={groupRef} className="reveal-group max-w-7xl mx-auto px-4">
        <h2 className="reveal-item text-2xl font-bold text-navy-900">{brandsTitle}</h2>
        <p className="reveal-item mt-2 max-w-prose leading-relaxed text-navy-500">
          {brandsSubtitle}
        </p>
        {/* Сетка, а не горизонтальный скролл: 12 брендов делятся на 3, 4 и 6 без
            остатка, поэтому последний ряд всегда полный и ряд центрирован сам
            собой. Скролл прижимал витрину влево и прятал 8 брендов за краем. */}
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
          {brands.map((brand, i) => (
            <div
              key={brand.slug}
              className="reveal-item"
              style={{ '--reveal-delay': revealDelay(i) } as CSSProperties}
            >
              <BrandTileLink brand={brand} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
