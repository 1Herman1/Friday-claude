# Проект: hb-landing (лендинг услуг H&B team)

Специфика проекта. Универсальные правила, агенты и воркфлоу — в `CLAUDE.md` и
`docs/core/`. Здесь — только то, что относится именно к этому проекту.

## Рабочая ветка

Ветка: `main`
Репозиторий: `1Herman1/hb_landing`

Правила ветвления — по `CLAUDE.md`: одна ветка на репозиторий, новых не заводить.

## Пользователь

Имя: Гермес (на сайте — Герман Брызгалов, команда «H&B team»)

Опыт: сайты на WordPress и Shopify, SEO. Структуру проектов понимает, код — не всегда.

Как общаться:
- Объяснять код простыми словами, расшифровывать термины
- Аналогии с хоккеем

## Контент владельца (не менять при редактуре без запроса)

- Имя на сайте: **Герман Брызгалов**, команда **H&B team**
- Телефон: **+7 916 965 56 11** (`tel:+79169655611`)
- Telegram: **@h_and_b_team** (https://t.me/h_and_b_team)
- Email: **gera103546@gmail.com**

Цифры «8+ лет / 40+ проектов», все кейсы портфолио и их метрики — **вымышленные**
(по заданию владельца). Собраны в `hb-landing/src/content/cases.ts` и секции Hero —
править в одном месте.

## Технологический стек (реальный)

ОТЛИЧАЕТСЯ от дефолта `docs/core/stack.md`: **не Next.js, не React-SPA** — не
предлагать `app/api/**/route.ts`, NextAuth, Vercel-specific, Zustand, React Router.
Бэкенда нет вообще: контакты — прямые ссылки `tel:` / `mailto:` / `t.me`, форм с
отправкой на сервер нет.

### Frontend
- Framework: Astro 5 (SSG, `output: "static"`)
- Language: TypeScript strict
- Styling: Tailwind CSS 4 через `@tailwindcss/vite`; токены — в
  `src/styles/global.css` блоком `@theme` (без tailwind.config)
- Шрифты: `@fontsource-variable/montserrat` + `@fontsource-variable/open-sans`
  (локально, кириллические сабсеты обязательны)
- Картинки: встроенный `astro:assets` (`<Image />`); НЕ устаревший `@astrojs/image`

### Backend
- Нет. Статический сайт.

### База данных и хранилище
- Нет. Контент кейсов — типизированный `src/content/cases.ts`.

### Инфраструктура
- Размещение в репо: папка `hb-landing/` в корне, **ВНЕ npm workspaces**
  (свой `package.json` + свой `package-lock.json`). Причины: Tailwind 4 (Astro)
  конфликтует по hoisting с Tailwind 3.4 остальных workspace-пакетов; независимый
  жизненный цикл и деплой; корневой `npm run build --workspaces` не должен
  собирать лендинг.
- Команды: `cd hb-landing && npm install`, `npm run dev` / `build` / `preview`
  (dev/preview — порт 4321)
- Деплой: любой статический хостинг (dist/), решается отдельно

## Медиа

- Обложки кейсов: `hb-landing/src/assets/cases/*.jpg` (оптимизирует `astro:assets`)
- Видео и постер финального баннера: `hb-landing/public/media/banner/`
- Генерация — агент `media-generator` (Artlist) по бренд-киту из `brand.md` и
  `design-system/MASTER.md` этого проекта (НЕ Симбы), после — проверка `brand-guard`

## Бюджеты качества

- Lighthouse Performance ≥ 95, Core Web Vitals зелёные
- JS первой загрузки < 50KB (фактическая цель ~2–3KB: диалог контактов + lazy-видео)
- Видео баннера ≤ 4–6 МБ, `preload="none"`, подгрузка при приближении к секции

## Старт каждого нового чата

1. Прочитать этот файл и `CLAUDE.md`
2. Поприветствовать пользователя
3. Напомнить рабочую ветку и репозиторий

## Git

- Коммитить только по явной просьбе пользователя
- Пушить на указанную выше ветку
- Сообщения коммитов: короткие, на английском, «что и зачем»
- Не создавать Pull Request без явной просьбы
