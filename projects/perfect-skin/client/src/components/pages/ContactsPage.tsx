import { IconPhone, IconMail, IconStore } from '@/components/icons'

export function ContactsPage() {
  return (
    <div className="container-app py-12 md:py-20">
      {/* Header */}
      <h1 className="text-2xl font-heading font-bold uppercase tracking-tight text-foreground mb-12 md:mb-16">
        Контакты
      </h1>

      {/* Contact Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 md:mb-16">
        {/* Phone Card */}
        <div className="border border-border rounded-block bg-card p-8 md:p-10">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-pill bg-primary/10 flex items-center justify-center flex-shrink-0">
              <IconPhone className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-sans font-semibold uppercase tracking-wide text-foreground mb-3">
                Телефон
              </h2>
              <a
                href="tel:+74951832848"
                className="text-body font-semibold text-foreground hover:text-primary transition-colors block mb-2"
              >
                +7 (495) 183-28-48
              </a>
              <p className="text-body-sm text-muted-foreground">
                Пн-Пт 10–21
                <br />
                Сб 11–17
              </p>
            </div>
          </div>
        </div>

        {/* Email Card */}
        <div className="border border-border rounded-block bg-card p-8 md:p-10">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-pill bg-primary/10 flex items-center justify-center flex-shrink-0">
              <IconMail className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-sans font-semibold uppercase tracking-wide text-foreground mb-3">
                Email
              </h2>
              <a
                href="mailto:mail@perfect-skin.shop"
                className="text-body font-semibold text-foreground hover:text-primary transition-colors"
              >
                mail@perfect-skin.shop
              </a>
            </div>
          </div>
        </div>

        {/* Address Card */}
        <div className="border border-border rounded-block bg-card p-8 md:p-10">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-pill bg-primary/10 flex items-center justify-center flex-shrink-0">
              <IconStore className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-sans font-semibold uppercase tracking-wide text-foreground mb-3">
                Адрес
              </h2>
              <p className="text-body text-foreground">
                Москва
                <br />
                Звенигородское шоссе, 3Ас1
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Legal Info */}
      <div className="border-t border-border pt-12 md:pt-16">
        <div className="space-y-4 text-body-sm text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground mb-2">Реквизиты</p>
            <p>
              ИП Рыбко Анна Александровна
              <br />
              ОГРНИП 321508100460474
            </p>
          </div>

          <p>
            Косметика надлежащего качества обмену и возврату не подлежит (Постановление Правительства РФ №55 от 19.01.1998).
          </p>
        </div>
      </div>
    </div>
  )
}
