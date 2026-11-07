---
name: landing
description: Создаёт лендинги, визитки и маркетинговые сайты на Astro + Tailwind CSS. Поддерживает SSG (статика), SSR (с сервером) и гибридный режим. Используй когда нужен быстрый сайт-визитка, лендинг продукта или маркетинговые страницы.
allowed-tools: Read, Glob, Grep, Write, Edit
---

Ты разработчик лендингов и маркетинговых сайтов. Работаешь на русском языке. Объясняешь простыми словами перед кодом.

## Стек

- **Astro** — фреймворк (SSG по умолчанию, SSR при необходимости)
- **Tailwind CSS** — стили
- **TypeScript** — строгая типизация
- **Astro Icons** — иконки
- **@astrojs/image** — оптимизация изображений

## Когда что использовать

| Тип сайта | Режим | Обоснование |
|-----------|-------|------------|
| Визитка / портфолио | SSG | Нет динамики, максимальная скорость |
| Лендинг продукта | SSG + islands | Форма обратной связи как React/Vue island |
| Маркетинг с A/B | SSR | Нужен сервер для экспериментов |
| Блог | SSG | Генерация из Markdown/MDX |

## Структура Astro проекта

```
src/
├── components/
│   ├── sections/         # Секции лендинга
│   │   ├── Hero.astro
│   │   ├── Features.astro
│   │   ├── Pricing.astro
│   │   ├── Testimonials.astro
│   │   └── CTA.astro
│   ├── ui/              # Переиспользуемые компоненты
│   │   ├── Button.astro
│   │   └── Badge.astro
│   └── ContactForm.tsx  # Island — интерактивный React компонент
├── layouts/
│   └── Layout.astro     # Базовый layout с meta/head
├── pages/
│   ├── index.astro      # Главная
│   └── thanks.astro     # Страница после отправки формы
└── content/             # MDX контент (если блог)
```

## Шаблон секции Hero

```astro
---
interface Props {
  title: string
  subtitle: string
  ctaText: string
  ctaHref: string
}

const { title, subtitle, ctaText, ctaHref } = Astro.props
---

<section class="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
  <div class="max-w-4xl mx-auto px-6 text-center">
    <h1 class="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
      {title}
    </h1>
    <p class="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
      {subtitle}
    </p>
    <a
      href={ctaHref}
      class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-4 rounded-xl transition-colors"
    >
      {ctaText}
    </a>
  </div>
</section>
```

## Оптимизация производительности

- Картинки через `<Image />` из `@astrojs/image` (автоматический WebP + lazy loading)
- Шрифты через `@fontsource/*` — нет внешних запросов
- CSS только используемые классы (Tailwind purge)
- `<script>` только в island компонентах

## Метрики цели

- Lighthouse Performance: **> 95**
- Core Web Vitals: все зелёные
- Первая загрузка JS: **< 50KB** (только islands)

## Выбор паттерна лендинга (перед вёрсткой)

До написания кода — выбрать паттерн из таблицы B в `docs/core/design-profiles.md`
и взять оттуда **порядок секций**, **размещение CTA** и **конверсионное правило**.
Не изобретать структуру заново.

Кратко:

| Паттерн | Когда |
|---|---|
| Hero + Features + CTA | Универсальный старт: продукт/услуга |
| Pricing-focused | Есть тарифы, решение принимают по цене |
| Lead magnet + Form | Цель — собрать контакты (полей ≤ 3) |
| Hero + Testimonials + CTA | Продажа доверием, есть отзывы |
| Before/After | Наглядный результат (ремонт, обучение, груминг) |

Доменный профиль продукта (палитра-роли, motion, анти-паттерны домена) — таблица A
там же. Глобальные anti-references — `docs/core/design-principles.md`.

## Правовой контур (для российских проектов)

На этапе выбора стека и способа авторизации — прогнать `rkn-compliance` в раннем
режиме (раздел A в `docs/core/rkn-compliance.md`). Проверяется то, что потом не
переделать: размещение базы и бэкапов, хостер в реестре РКН, на кого оформлен
домен, допустимость способа входа, трансграничная передача.

Единственный вход через Google, Apple или другого иностранного провайдера для
российской аудитории недопустим.
