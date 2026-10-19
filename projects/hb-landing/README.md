# H&B team — лендинг

Лендинг на Astro 5 + Tailwind CSS 4 для компании H&B team (веб-разработка и внедрение ИИ).

## Адрес

**Сайт**: https://1herman1.github.io/hb_landing/

## Установка и разработка

```bash
# Установка зависимостей
npm install

# Локальная разработка (http://localhost:3000)
npm run dev

# Сборка для продакшена
npm run build

# Просмотр собранного сайта локально
npm run preview
```

## Конфигурация

- **Site**: https://1herman1.github.io
- **Base path**: /hb_landing
- **Output**: Static HTML (GitHub Pages)

Деплой происходит автоматически при пуше в ветку `main`.

## Структура

```
src/
├── components/        # Астро-компоненты
│   ├── sections/     # Секции страницы
│   └── ui/           # UI-компоненты
├── layouts/          # Шаблоны
├── pages/            # Страницы
├── styles/           # Глобальные стили
└── content/          # Контент (данные)

public/              # Статичные ассеты
docs/                # Документация проекта
```

## Ссылки

- Документация: `docs/project.md`
- Брендбук: `docs/brand.md`
- Дизайн-система: `docs/design-system/`
