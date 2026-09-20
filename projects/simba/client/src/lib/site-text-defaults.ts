/** Справочник всех ключей текстов сайта для admin-интерфейса.
    Каждый ключ указывает: где используется (label), группа (group), текущее значение (value).
    Источник истины для сервера при инициализации. */

export const SITE_TEXT_DEFAULTS: Record<string, { label: string; group: string; value: string }> = {
  // Главная страница
  'home.quiz.title': {
    label: 'Квиз: заголовок',
    group: 'Home / Quiz',
    value: 'Не знаете, какой корм выбрать?',
  },
  'home.quiz.subtitle': {
    label: 'Квиз: подпись',
    group: 'Home / Quiz',
    value: 'Несколько вопросов о питомце: возраст, размер, здоровье. Подберём не просто бренд, а конкретную линейку и вкус. Займёт около минуты.',
  },
  'home.categories.title': {
    label: 'Категории: заголовок',
    group: 'Home / Categories',
    value: 'Категории',
  },
  'home.advantages.title': {
    label: 'Преимущества: заголовок',
    group: 'Home / Advantages',
    value: 'Почему у нас',
  },
  'home.advantages.subtitle': {
    label: 'Преимущества: подпись',
    group: 'Home / Advantages',
    value: 'Что мы делаем иначе, чем маркетплейс',
  },
  'home.popular.title': {
    label: 'Популярные товары: заголовок',
    group: 'Home / Popular Products',
    value: 'Популярные товары',
  },
  'home.recommend.title': {
    label: 'Рекомендуем: заголовок',
    group: 'Home / Popular Products',
    value: 'Рекомендуем',
  },
  'home.brands.title': {
    label: 'Бренды: заголовок',
    group: 'Home / Brands',
    value: 'Бренды, которым мы доверяем',
  },
  'home.brands.subtitle': {
    label: 'Бренды: подпись',
    group: 'Home / Brands',
    value: 'Все бренды, что есть в наличии. Нажмите на любой — откроется его каталог.',
  },
  'home.about.eyebrow': {
    label: 'О компании: надпись перед заголовком',
    group: 'Home / About',
    value: 'О компании',
  },
  'home.about.title': {
    label: 'О компании: заголовок',
    group: 'Home / About',
    value: 'Кто мы',
  },
  'home.trust.title': {
    label: 'Доверие: заголовок',
    group: 'Home / Trust',
    value: 'Почему нам доверяют',
  },
  'home.trust.subtitle': {
    label: 'Доверие: подпись',
    group: 'Home / Trust',
    value: 'Не обещания, а то, что можно проверить',
  },
  'home.blog.title': {
    label: 'Блог: заголовок',
    group: 'Home / Blog',
    value: 'Блог',
  },
  'home.blog.subtitle': {
    label: 'Блог: подпись',
    group: 'Home / Blog',
    value: 'Разбираем составы кормов и отвечаем на вопросы, которые чаще всего задают на консультациях.',
  },
  'home.faq.title': {
    label: 'FAQ: заголовок',
    group: 'Home / FAQ',
    value: 'Вопросы и ответы',
  },

  // Страницы
  'page.about.title': {
    label: 'О магазине: заголовок',
    group: 'Pages / About',
    value: 'Кто мы',
  },
  'page.delivery.title': {
    label: 'Доставка и оплата: заголовок',
    group: 'Pages / Delivery',
    value: 'Доставка и оплата',
  },
  'page.delivery.lead': {
    label: 'Доставка и оплата: подпись',
    group: 'Pages / Delivery',
    value: 'Отправляем в день заказа — любым способом',
  },
  'page.returns.title': {
    label: 'Возврат и обмен: заголовок',
    group: 'Pages / Returns',
    value: 'Обмен и возврат',
  },
  'page.bonuses.title': {
    label: 'Бонусы: заголовок',
    group: 'Pages / Bonuses',
    value: 'Бонусная программа',
  },
  'page.trust.title': {
    label: 'Гарантии: заголовок',
    group: 'Pages / Trust',
    value: 'Почему нам доверяют',
  },
  'page.trust.subtitle': {
    label: 'Гарантии: подпись',
    group: 'Pages / Trust',
    value: 'Не обещания, а то, что можно проверить',
  },
  'page.blog.title': {
    label: 'Блог: заголовок (страница блога)',
    group: 'Pages / Blog',
    value: 'Блог',
  },
  'page.faq.title': {
    label: 'FAQ: заголовок (страница FAQ)',
    group: 'Pages / FAQ',
    value: 'Вопросы и ответы',
  },
  'page.certificates.title': {
    label: 'Сертификаты: заголовок',
    group: 'Pages / Certificates',
    value: 'Документы на продукцию',
  },
}
