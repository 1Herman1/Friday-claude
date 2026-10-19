# Дизайн-система: hb-landing (H&B team)

Источник истины по палитре, типографике и шкалам для `hb-landing/`.
Проверяется `design-lint.mjs`. Переопределения страниц — `pages/*.md` (приоритетнее).

## Mood

`личное, но собранное` · `крупный чистый гротеск` · `светлый воздух` ·
`инженерная точность` · `дружелюбный эксперт` · `тёплый терракотовый акцент`

## Палитра (тёмная тема)

**Фон и текст:**
| Токен | HEX / RGBA | Назначение |
|---|---|---|
| `dark` | `#14161A` | Фон страницы (основной) |
| `on-dark` | `#F4F4F1` | Заголовки (контраст ~15:1) |
| `on-dark-body` | `#C4C9D0` | Основной текст абзацев |
| `on-dark-muted` | `#9BA1AA` | Подписи, теги, вторичный текст |
| `on-dark-faint` | `#6E747D` | Только декоративные номера секций |

**Поверхности и границы:**
| Токен | RGBA | Назначение |
|---|---|---|
| `dark-surface` | `rgba(244,244,241,0.04)` | Карточки, слабо видимые плашки |
| `dark-surface-hover` | `rgba(244,244,241,0.07)` | Hover карточек, вторичные элементы |
| `dark-line` | `rgba(244,244,241,0.12)` | Бордеры карточек, линии разделения |
| `dark-line-strong` | `rgba(244,244,241,0.20)` | Более сильные разделители |
| `dark-divider` | `rgba(244,244,241,0.08)` | Горизонтальные разделители между секциями |

**Акцент:**
| Токен | HEX / RGBA | Назначение |
|---|---|---|
| `accent` | `#C2410C` | Заливка кнопок (text: #FFF) |
| `accent-hover` | `#9A3412` | Hover кнопок |
| `accent-on-dark` | `#F97316` | Акцентный текст на тёмном (заголовки, ссылки, слэш) |
| `accent-on-dark-hv` | `#FB923C` | Hover акцентного текста |
| `accent-wash` | `rgba(249,115,22,0.10)` | Фон для выделенных блоков (метрики, шаги) |
| `accent-wash-line` | `rgba(249,115,22,0.22)` | Бордер для выделенных блоков |

**Правило цвета:** `#C2410C` — заливаем (background кнопок), `#F97316` — пишем (text на тёмном).

Запрещено: purple-blue градиенты, чистый `#000`, серый текст с контрастом < 4.5:1,
тёмные «глоу»-свечения.

## Типографика

**Три семейства:**
- **Заголовки (H1/H2):** Coolvetica (self-hosted freeware, 400 вес) — `public/fonts/coolvetica.woff`
  - Fallback: Montserrat Variable (700/800) — `@fontsource-variable/montserrat`
- **Основной текст (body/абзацы):** Open Sans Variable, веса 400/600 — `@fontsource-variable/open-sans`
- **UI-текст (теги, навигация, кнопки, подписи):** Roboto Mono, веса 400/500 —
  `@fontsource/roboto-mono` (включая cyrillic-400, cyrillic-500)

Подключение локально через fontsource и self-hosted WOFF (без внешних запросов);
проверить, что cyrillic-сабсет попал в бандл.
Fallback-стек: `Arial, sans-serif` для Coolvetica (геометричный гротеск),
`monospace` для Roboto Mono, `system-ui, -apple-system, "Segoe UI", sans-serif`
для Open Sans — слово «Inter» не должно встречаться нигде, даже в fallback

Шкала:
- h1 (hero): `clamp(2.75rem, 7vw, 5.5rem)`, Montserrat 800
- Слоган баннера: Montserrat 800, uppercase, `clamp(3rem, 10vw, 9rem)`
- h2 секций: `clamp(2rem, 4vw, 3.25rem)`, Montserrat 700
- h3 карточек: `1.375rem`, Montserrat 700
- body: `1.125rem / 1.7`, Open Sans 400
- подписи/теги: `0.875rem`, Open Sans 600
- Строки текста ≤ 70 символов (`max-w-[65ch]`)
- Цифры метрик: `tabular-nums`

## Отступы и сетка

- Секции: `py-24` мобайл → `py-32` десктоп (VISUAL_DENSITY=3)
- Контейнер: `max-w-6xl mx-auto px-5 md:px-8`
- Нумерация секций «01 / Услуги» — редакционный приём, Montserrat 700,
  `muted-foreground`

## Форма и глубина

- Радиусы: карточки 16px (2xl), кнопки 12px (xl), полные 44px
- На тёмном: глубина через `border: 1px solid dark-line` + hover смена
  `background-color` и `border-color` (200ms ease-out), **БЕЗ translateY**
- Никаких карточек-в-карточках, никаких боковых полосок-бордеров как декора

## Motion

- Hover карточек: смена `background-color` и `border-color`, 200ms ease-out (НЕ translateY)
- Hover текстовых ссылок: смена `color`, 200ms ease-out
- Появление секций 1–2: fade + translateY(8px), 600ms ease-out; остальные секции без анимации
- Заголовки секций: побословная анимация reveal (600ms ease), delay per word
- `prefers-reduced-motion: reduce` глушит всё, включая автоплей видео-баннера
  (показывается постер)
- Запрещено: bounce/elastic easing, scroll-driven анимации, translate при hover

## Компоненты

- **Button**: primary (accent, on-accent #FFF) / ghost (border line, foreground)
- **Tag**: чип `muted` + `muted-foreground`, radius 8px
- **SectionTitle**: номер «0N /» + заголовок h2
- **CaseCard**: обложка 16:10 → заголовок → теги → `<details>`-раскрытие
  «Задача / Решение / Результат»
- **ContactDialog**: нативный `<dialog>`, 3 строки-ссылки ≥ 44px
- Тач-таргеты везде ≥ 44×44px

## Медиа-стиль (для media-generator)

- Обложки кейсов: 1600×1000 (16:10), единая серия — абстрактная
  предметно-графическая композиция на светлом фоне `#FAFAF8` в палитре проекта,
  без людей крупным планом, без стоковых 3D-рендеров, без текста
- Видео баннера: 1920×1080, 10–15 с бесшовный луп, тёмное, малоконтрастное
  (поверх крупная белая типографика), без текста/людей/логотипов
