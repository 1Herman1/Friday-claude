# Движок моторики: от правила к примитиву

`docs/core/motion.md` отвечает на вопрос «как должно двигаться». Этот файл —
на вопрос «чем это делается». Без него библиотека становится ещё одним
способом нарушать собственные правила.

Движок — [anime.js](https://github.com/juliangarnier/anime) v4, лицензия MIT,
ноль зависимостей в проде, модульная сборка (берём только нужные импорты).

## Главное ограничение

**Библиотека ничего не знает про `prefers-reduced-motion`.** В её исходниках
нет ни одного упоминания. У нас это прямой запрет в `CLAUDE.md`.

Поэтому единая точка входа — **обёртка моторики проекта**, и правило жёсткое:

> Прямой импорт `from 'animejs'` в компонентах запрещён. Только через обёртку.

Обёртка при включённой системной настройке убирает движение, но оставляет
`opacity` и цвет — интерфейс мягко проявляется, а не телепортируется. Это ровно
то поведение, которое описано в §5 `motion.md`.

## CSS остаётся базой

Движок не отменяет `transition`. Правило выбора:

| Задача | Чем делать |
|---|---|
| Ховер, нажатие, смена цвета, простой показ/скрытие | CSS `transition` |
| Значение во времени (счётчик, прогресс), таймлайн, жест, реакция на скролл | Движок |
| Готовая анимация от дизайнера (иконка состояния) | Lottie |

CSS-переход дешевле и прерываемее. Движок берём там, где CSS не достаёт:
когда нужно значение, координация нескольких шагов или физика жеста.

## Таблица соответствия

| Правило из `motion.md` | Примитив |
|---|---|
| Easing-дерево (§2) | `EASE.out` / `EASE.inOut` / `EASE.drawer` |
| Таблица длительностей (§3) | `DURATION.press` … `DURATION.drawer` |
| Выход = 65–75% от входа | `exitDuration(enter)` |
| Стаггер 30–80мс (§4) | `stagger(50)` |
| Пружины damping + response (§6) | `spring(damping, response)` |
| Scroll reveal | `scrollReveal(targets, params)` |
| `prefers-reduced-motion` (§5) | Встроено в `animate`, отдельно — `prefersReducedMotion()` |
| Momentum, rubber-banding (§7) | `createDraggable` |
| Длительность от расстояния | Считается в компоненте, подставляется в `duration` |

`ease-in` в обёртке намеренно отсутствует: `design-lint.mjs` помечает его как
ошибку, и давать к нему удобный доступ было бы противоречием.

## Пружины: перевод величин

Доктрина оперирует `damping` + `response` (подход Apple), библиотека —
`bounce` + `duration`. Это одна модель с разных сторон, перевод делает обёртка:

- `damping 1.0` → `bounce 0` — критическое затухание, без отскока
- `damping 0.8` → `bounce 0.2` — лёгкий overshoot после жеста с инерцией
- `response 0.4с` → `duration 400`

## Что из библиотеки НЕ берём

- **Полный бандл.** 40 КБ в gzip ради пары эффектов — только точечные импорты.
- **`layout` / AutoLayout** (1612 строк) — анимация перестроений сетки, задачи нет.
- **`adapters/three`** — Three.js в проектах не используется.
- **`svg` morph** — задач под морфинг нет.
- **Замену Lottie.** Разные инструменты: Lottie проигрывает готовый файл
  дизайнера, движок анимирует код. См. `ADR-003`.

## Бюджет

Точечные импорты, которые мы используем, тянут ядро (`engine` + `timer` +
`animation`) плюс нужный модуль. Прирост бандла измеряется числом до и после,
а не на глаз. Новый модуль движка в проекте — повод пересчитать.

## `createDraggable`: контракт шаблона (stage04)

Проверено на **animejs 4.5.0**, а не на предполагаемом API v3. Импорт
`animejs/draggable` остаётся внутри обёртки. Все прежние экспорты сохранены;
существующий `animate` этим изменением не переписан.

```ts
import { createDraggable } from './motion'

// Только после mount; SSR возвращает null, не создаёт DOM/observer/listeners.
const motion = createDraggable(element, {
  y: false,
  container: [0, 500, 0, 0],
  onRelease(draggable) {
    // Семантическое состояние приложения берётся из фактической позиции,
    // НЕ из destX: reduced motion отменяет запланированное settling.
    console.log(draggable.x)
  },
})
// При unmount обязательно этот метод, НЕ motion.draggable.revert():
motion?.destroy()
```

- Возвращает `MotionDraggable | null`: `{ readonly draggable, destroy() }`.
  `DraggableOptions` выводится из настоящего `Parameters<typeof animeDraggable>`;
  параметры осей, границы и callbacks — типы движка, не выдуманный локальный API.
- Обычный режим: native drag, grab offset, прерывание новым захватом,
  momentum/boundary settling. `releaseEase: spring(...)` можно задать явно;
  по умолчанию остаётся native release, CSS easing для drag не подставляется.
- Reduced motion **не отключает необходимое прямое манипулирование** указателем.
  Отменяется автоматическое движение после release (также snap/возврат к границе).
  Элемент остаётся в текущей визуальной позиции, не прыгает в `destX/destY`.
  Это целевое уточнение общей доктрины для жеста, не разрешение на декоративный motion.
- Preference меняется без reload: во время инерции `stop()` замораживает текущую
  позицию; во время drag pointer-follow сохраняется и release затем останавливается.
  Возврат к `no-preference` не запускает старую инерцию, но следующий жест снова
  использует обычный release. При отсутствии `matchMedia` действует обычный режим.
- В 4.5.0 `onRelease` вызывается **после** планирования анимаций: wrapper вызывает
  `stop()` до и после пользовательского callback. Callback сохраняется и вызывается
  один раз; `onSettle` не является гарантией завершения отменённой инерции.
  Native `onSnap`/destinations могут сообщать запланированную цель, которую reduced
  motion не достигает. Не использовать их как окончательное состояние приложения.
- `destroy()` идемпотентен: отписывает media query, снимает engine events/tickers/
  ResizeObserver и восстанавливает исходные inline styles через `revert()`.
  Это unmount cleanup, не «оставить конечную позицию». В 4.5.0 `revert()` в одиночку
  оставляет touch-prevention listeners активного drag; wrapper сначала выполняет
  `handleUp()` с заглушёнными release/snap/update/settle callbacks, затем `revert()`.
  Dispose не публикует ложный пользовательский release. После destroy handle не переиспользовать.
- `.draggable` — низкоуровневый escape hatch, не безопасный второй API. Ручные
  `animateInView`, смена callbacks, `enable`, `revert` и прямые анимации могут обойти
  политику wrapper. Компонент отвечает за ограничения/snap и бизнес-состояние,
  особенно когда reduced motion оставляет элемент вне snap/границы.

### Keyboard / a11y — не входит в drag-примитив

Это **drag-only**, не готовый keyboard widget: нет tabindex/role, Arrow/Home/End,
Escape/cancel, focus management, ARIA value/live announcements, reorder semantics
или альтернативной кнопочной операции. Продукт обязан дать доступный эквивалент
действия без dragging (например, обычные кнопки «переместить влево/вправо»),
выбрать корректный APG pattern и обеспечить клавиатуру/скринридер самостоятельно.
Одно добавление `tabindex` доступностью не считается. Клавиатурные действия не
анимируются по `motion.md`. Реальный touch/pen, pointer capture и screen reader
не сертифицированы этим mouse pilot: native engine 4.5 использует document-level
mouse/touch listeners, а не обещанный в Apple-паттерне `setPointerCapture()`.

### Воспроизводимая проверка

`node .codex/scripts/test-motion-template.mjs` — только contract smoke (не browser PASS).
Полный strict TypeScript + SSR + **headless** real-engine temporal pilot:

```sh
MOTION_DEPS="$HOME/.hermes/cache/scratch/motion-stage04" \
MOTION_BROWSER="/absolute/path/to/existing/chrome-headless-shell" \
node .codex/scripts/test-motion-template.mjs --integration
```

Установка, lock/integrity, RED/GREEN receipts, значения до/во время/после,
ограничения и цена бандла —
`docs/research/design-agent-upgrade/rollout/motion-pilot/stage04-motion.md`.
Runner ничего не устанавливает, требует явный executable, всегда `headless: true`,
слушает только loopback на случайном порту и закрывает browser/server после теста.
PNG остаются в Hermes scratch; в репозиторий входят только текстовые fixtures/receipts.

## Ревью

Моторику ревьюит `design-reviewer` — **по снимку**
(`.claude/scripts/screenshot.mjs`), а не по исходнику. Подбор конкретного
примитива под задачу — агент `motion-curator`.
