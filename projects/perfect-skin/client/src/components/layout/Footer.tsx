import { Link } from 'react-router-dom'

const catalogLinks = [
  { label: 'Кремы для лица и шеи', href: '/catalog' },
  { label: 'Сыворотки', href: '/catalog' },
  { label: 'Маски и пилинги', href: '/catalog' },
  { label: 'Очищение', href: '/catalog' },
  { label: 'Уход за телом', href: '/catalog' },
  { label: 'Парафармацевтика', href: '/catalog' },
  { label: 'Подарочные наборы', href: '/catalog' },
  { label: 'Линейка ISSEIMI Base', href: '/catalog' },
  { label: 'Линейка ISSEIMI MD', href: '/catalog' },
  { label: 'Линейка ISSEIMI Nat', href: '/catalog' },
  { label: 'Линейка GLACÉE Skincare', href: '/catalog' },
]

export function Footer() {
  return (
    <footer className="bg-dark text-dark-foreground">
      <div className="container-app py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          {/* Column 1: About */}
          <div>
            <h3 className="text-h3 font-heading font-bold mb-6">О компании</h3>
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
                  to="/about"
                  className="text-body-sm font-sans hover:text-accent-on-dark transition-colors duration-200 focus-visible:outline-ring"
                >
                  О компании
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
            </ul>
            <p className="text-body-sm font-sans leading-body mb-4">
              Perfect Skin — магазин профессиональной испанской косметики брендов ISSEIMI и GLACÉE Skincare.
            </p>
            <p className="text-body-sm font-sans leading-body">
              Мы работаем с 2017 года как официальный дистрибьютор премиум-косметики от фармконцерна Heber Farma.
            </p>
          </div>

          {/* Column 2: Catalog */}
          <div>
            <h3 className="text-h3 font-heading font-bold mb-6">Каталог</h3>
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
          </div>

          {/* Column 3: Contacts */}
          <div>
            <h3 className="text-h3 font-heading font-bold mb-6">Контакты</h3>
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
            <div className="space-y-4">
              <div>
                <p className="text-label font-sans font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Телефон
                </p>
                <a
                  href="tel:+74951832848"
                  className="text-body-sm font-sans hover:text-accent-on-dark transition-colors duration-200 focus-visible:outline-ring block"
                >
                  +7 (495) 183-28-48
                </a>
                <p className="text-body-sm font-sans text-muted-foreground mt-1">
                  Пн-Пт 10–21, Сб 11–17
                </p>
              </div>
              <div>
                <p className="text-label font-sans font-semibold uppercase tracking-wide text-muted-foreground mb-2">
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
                <p className="text-label font-sans font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Адрес
                </p>
                <p className="text-body-sm font-sans">Москва, Звенигородское шоссе, 3Ас1</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Info */}
        <div className="border-t border-border pt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-body-sm font-sans">
            <p className="text-muted-foreground">
              ИП Рыбко Анна Александровна, ОГРНИП 321508100460474
            </p>
            <p className="text-muted-foreground">
              Косметика надлежащего качества обмену и возврату не подлежит
              (Постановление Правительства РФ №55 от 19.01.1998)
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
