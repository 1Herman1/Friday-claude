# Questionnaire (`/questionnaire`)

## Layout
- Двухколонная сетка на десктопе: `lg:grid lg:grid-cols-12 lg:gap-12`
- Левая колонна: `lg:col-span-6` — заголовок, описание, кнопка, блок подарка, подпись
- Правая колонна: `lg:col-span-6` — сцена с животными
- Отступы: мобильный `px-4 py-12`, десктопный `lg:px-8 lg:py-16`
- Контейнер: `max-w-7xl` (вместо обычного `max-w-2xl`)

## Typography
- Заголовок: `text-4xl md:text-5xl lg:text-5xl xl:text-6xl lg:leading-[1.05] font-bold`
- Параграф: ограничение `lg:max-w-[46ch]`, выравнивание `lg:text-left` (вместо `text-center`)
- Шаг (номер + текст): `text-base font-semibold` для названия, `text-sm` для описания

## Assets & Scene
- **Кот** (`cat.png`, 848×1264): размер `lg:h-[60%] xl:h-[68%]`, позиция `z-0 -mr-6`, фильтр `[filter:saturate(0.92)_contrast(0.97)_brightness(1.02)]`
- **Пёс** (`smiledog.png`, 409×610): размер `lg:h-[80%] xl:h-[88%]`, позиция `z-10`, маска снизу `[mask-image:linear-gradient(to_top,transparent_0%,black_6%)]`
- Контейнер сцены: `lg:h-[520px] xl:h-[600px]`, flex с `items-end justify-center`
- Подложка (тень): `absolute left-[10%] right-[10%] bottom-2 h-12 rounded-full bg-navy-100/40 blur-2xl`
- Рендер сцены: условный (`useMediaQuery('(min-width: 1024px)')`) — не скачивать ~525 КБ PNG на мобильных

## Sections
- **How It Works**: только десктоп (`hidden lg:block mt-16`)
- Три шага с номерами (1, 2, 3) в кружках `w-9 h-9 rounded-full bg-ink text-white`
- Число вопросов в первом шаге: `QUESTIONS_IN_BRANCH` из `QuizFlow.tsx` (8)
- Сетка: `grid-cols-3 gap-6`

## Colors
- Фон страницы: `bg-blue-50`
- Блок подарка: `bg-white border border-line`
- Иконка подарка: `text-amber-600`
- Номер шага: `bg-ink` (цвет по токену Tailwind)
- Карточка шага: `bg-white rounded-card border border-line p-6`

## Responsive
- Мобильный: центрированный текст, блок подарка `flex` (по вертикали)
- Десктоп: `lg:text-left`, блок подарка `lg:inline-flex`
- Сцена: только если `useMediaQuery('(min-width: 1024px)')` → `true`, иначе не рендерится

## Notes
- Без `transform`-класса в сцене — глобальный `prefers-reduced-motion` сбрасывает все анимации, включая плановые
- Пропсы: `onStart: () => void`, `inModal?: boolean` (для модальных окон без 100dvh)
- Мобильная разметка неизменна: сохранены текущие классы, центрирование, блок подарка на весь контейнер
