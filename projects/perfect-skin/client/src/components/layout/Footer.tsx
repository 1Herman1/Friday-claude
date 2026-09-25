import { Link } from 'react-router-dom'
import { useMediaQuery } from '@/hooks/useMediaQuery'

const catalogLinks = [
  { label: 'Кремы для лица и шеи', href: '/catalog/kremy-dlya-litsa-i-shei' },
  { label: 'Сыворотки', href: '/catalog/syvorotki' },
  { label: 'Маски и пилинги', href: '/catalog/maski' },
  { label: 'Очищение', href: '/catalog/ochishchenie' },
  { label: 'Уход за телом', href: '/catalog/uhod-za-telom' },
  { label: 'Подарочные наборы', href: '/catalog/nabory' },
  { label: 'Линейка ISSEIMI Base', href: '/catalog/all?brand=isseimi&line=isseimi-base' },
  { label: 'Линейка ISSEIMI MD', href: '/catalog/all?brand=isseimi&line=isseimi-md' },
  { label: 'Линейка ISSEIMI Nat Collection', href: '/catalog/all?brand=isseimi&line=isseimi-nat-collection' },
  { label: 'Линейка GLACÉE Skincare', href: '/catalog/all?brand=glacee-skincare' },
]

export function Footer() {
  // md:open — несуществующий класс: open это атрибут. Управляем хуком,
  // key пересоздаёт details при смене брейкпоинта.
  const isDesktop = useMediaQuery('(min-width: 768px)')
  return (
    <footer className="bg-dark text-dark-foreground">
      <div className="container-app py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          {/* Column 1: About */}
          <div>
            <details key={isDesktop ? "da" : "ma"} className="group" open={isDesktop}>
              <summary className="cursor-pointer md:cursor-auto text-lg font-heading font-bold mb-6 list-none flex items-center justify-between gap-2 md:mb-6">
                О компании
                <svg className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-open:rotate-180 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </summary>
              <div>
                <ul className="space-y-2 mb-6">
                  <li>
                    <Link
                      to="/brands"
                      className="text-body-sm font-sans hover:text-accent-on-dark transition-colors duration-200 focus-visible:outline-ring"
                    >
                      Бренды
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pro"
                      className="text-body-sm font-sans hover:text-accent-on-dark transition-colors duration-200 focus-visible:outline-ring"
                    >
                      Специалистам
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/about"
                      className="text-body-sm font-sans hover:text-accent-on-dark transition-colors duration-200 focus-visible:outline-ring"
                    >
                      О компании
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/blog"
                      className="text-body-sm font-sans hover:text-accent-on-dark transition-colors duration-200 focus-visible:outline-ring"
                    >
                      Статьи
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/#faq"
                      className="text-body-sm font-sans hover:text-accent-on-dark transition-colors duration-200 focus-visible:outline-ring"
                    >
                      Вопросы и ответы
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/offer"
                      className="text-body-sm font-sans hover:text-accent-on-dark transition-colors duration-200 focus-visible:outline-ring"
                    >
                      Публичная оферта
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/privacy"
                      className="text-body-sm font-sans hover:text-accent-on-dark transition-colors duration-200 focus-visible:outline-ring"
                    >
                      Политика обработки данных
                    </Link>
                  </li>
                </ul>
                <p className="text-body-sm font-sans leading-body mb-4">
                  Perfect Skin — магазин профессиональной испанской косметики брендов ISSEIMI и GLACÉE Skincare.
                </p>
                <p className="text-body-sm font-sans leading-body">
                  Производитель — Heber Farma (Испания). Поставки — от официального дистрибьютора в России, работающего с концерном с 2017 года. Продавец — ИП Рыбко А. А.
                </p>
              </div>
            </details>
          </div>

          {/* Column 2: Catalog */}
          <div>
            <details key={isDesktop ? "db" : "mb"} className="group" open={isDesktop}>
              <summary className="cursor-pointer md:cursor-auto text-lg font-heading font-bold mb-6 list-none flex items-center justify-between gap-2 md:mb-6">
                Каталог
                <svg className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-open:rotate-180 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </summary>
              <ul className="space-y-2">
                {catalogLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-body-sm font-sans hover:text-accent-on-dark transition-colors duration-200 focus-visible:outline-ring"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          </div>

          {/* Column 3: Contacts */}
          <div>
            <details key={isDesktop ? "d2" : "m2"} className="group" open>
              <summary className="cursor-pointer md:cursor-auto text-lg font-heading font-bold mb-6 list-none flex items-center justify-between gap-2 md:mb-6">
                Контакты
                <svg className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-open:rotate-180 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </summary>
              <div>
                <ul className="space-y-2 mb-6">
                  <li>
                    <Link
                      to="/track"
                      className="text-body-sm font-sans hover:text-accent-on-dark transition-colors duration-200 focus-visible:outline-ring"
                    >
                      Проверить заказ
                    </Link>
                  </li>
                </ul>
                <div className="space-y-4 lg:space-y-4">
                  <div>
                    <p className="text-label font-sans font-semibold uppercase tracking-wide text-dark-foreground/70 mb-2">
                      Телефон
                    </p>
                    <a
                      href="tel:+74951832848"
                      className="text-body-sm font-sans hover:text-accent-on-dark transition-colors duration-200 focus-visible:outline-ring block"
                    >
                      +7 (495) 183-28-48
                    </a>
                    <p className="text-body-sm font-sans text-dark-foreground/70 mt-1">
                      Пн-Пт 10–21, Сб 11–17
                    </p>
                  </div>
                  <div>
                    <p className="text-label font-sans font-semibold uppercase tracking-wide text-dark-foreground/70 mb-2">
                      Email
                    </p>
                    <a
                      href="mailto:mail@perfect-skin.shop"
                      className="text-body-sm font-sans hover:text-accent-on-dark transition-colors duration-200 focus-visible:outline-ring"
                    >
                      mail@perfect-skin.shop
                    </a>
                  </div>
                  <div>
                    <p className="text-label font-sans font-semibold uppercase tracking-wide text-dark-foreground/70 mb-2">
                      Адрес
                    </p>
                    <p className="text-body-sm font-sans">Москва, Звенигородское шоссе, 3Ас1</p>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* Bottom Info */}
        <div className="border-t border-border pt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-body-sm font-sans">
            <p className="text-dark-foreground/70">
              ИП Рыбко Анна Александровна, ОГРНИП 321508100460474
            </p>
            <p className="text-dark-foreground/70">
              Косметика надлежащего качества обмену и возврату не подлежит
              (Постановление Правительства РФ №55 от 19.01.1998)
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
