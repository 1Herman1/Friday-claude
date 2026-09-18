/**
 * Единственный источник контактов магазина. Раньше телефон и почта были
 * продублированы в шапке и подвале — расходились при первой же правке.
 */
export const CONTACTS = {
  phone: '+7 936 505-00-14',
  phoneHref: 'tel:+79365050014',
  /** Отдельная линия для обмена и возврата. */
  returnsPhone: '+7 915 018-30-12',
  returnsPhoneHref: 'tel:+79150183012',
  email: 'info@simbazoo.ru',
  emailHref: 'mailto:info@simbazoo.ru',
  telegram: 'https://t.me/simbazooru',
  telegramChannel: 'https://t.me/simbachanel',
  hours: 'Отвечаем ежедневно 9:00–21:00',
  orders: 'Заказы на сайте — круглосуточно.',
} as const

export const MARKETPLACES = [
  {
    name: 'Яндекс Маркет',
    rating: '4,9',
    stats: '13 000+ заказов · 3 000+ отзывов',
    url: 'https://market.yandex.ru/cc/82doRs',
    showLink: true,
  },
  {
    name: 'Ozon',
    rating: '4,9',
    stats: '6 200+ заказов · 1 200+ отзывов',
    url: 'https://ozon.ru/s/simba-2856486',
    showLink: true,
  },
  {
    name: 'Авито',
    rating: '4,9',
    stats: '5 000+ заказов · 1 000+ отзывов',
    url: 'https://www.avito.ru/',
    showLink: false,
    /** URL ведёт на корень avito.ru, а не на профиль магазина —
        ссылку не показываем, но карточка должна выглядеть намеренным воздухом,
        не обрезкой. */
  },
] as const

/**
 * Сведения о продавце, обязательные при дистанционной торговле.
 * Банковские реквизиты сюда намеренно не вынесены: в подвале они не требуются,
 * а публиковать счёт — помогать тем, кто выдаёт себя за магазин. Их место —
 * страница «Реквизиты» для юрлиц или текст оферты.
 */
export const LEGAL = {
  entity: 'ИП Седова Алина',
  inn: 'ИНН 775148555871',
  ogrnip: 'ОГРНИП 325774600323186',
  address: '108801, г. Москва, вн.тер.г. муниципальный округ Коммунарка',
} as const
