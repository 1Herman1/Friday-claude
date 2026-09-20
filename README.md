# Friday — рабочая база ассистента Джарвиса

CLI-инструменты, веб-сайты и автоматизация, собранные в один репозиторий. Один рабочий стол для всех проектов. Реестр и правила — в [`docs/projects/README.md`](docs/projects/README.md).

## Проекты

| Проект | Что это | Где код | Где доки |
|--------|---------|----------|----------|
| [Симба](projects/simba) | Интернет-магазин зоотоваров | `projects/simba/` | [`docs/projects/simba/`](docs/projects/simba) |
| [HB Landing](projects/hb-landing) | Лендинг-визитка | `projects/hb-landing/` | [`docs/projects/hb-landing/`](docs/projects/hb-landing) |
| [Perfect Skin](projects/perfect-skin) | Магазин косметики | `projects/perfect-skin/` | [`docs/projects/perfect-skin/`](docs/projects/perfect-skin) |
| [Ветклиника](docs/projects/vet-clinic) | SEO/GEO-аналитика | — | [`docs/projects/vet-clinic/`](docs/projects/vet-clinic) |
| [Nullume](tools/nullume) | CLI генерации медиа через kie.ai | `tools/nullume/` | [`docs/projects/nullume/`](docs/projects/nullume) |
| [Стройматериалы](projects/stroymat) | Страница обновления ассортимента | `projects/stroymat/` | [`docs/projects/stroymat/`](docs/projects/stroymat) |

## Nullume за три команды

Инструмент для генерации изображений, видео, музыки и озвучки через kie.ai с точной калькуляцией цены.

```bash
# Установка
cd tools/nullume && npm ci

# Настройка (один раз: введи ключ kie.ai)
npx tsx src/cli/index.ts setup

# Генерируй картинку: укажи модель и промпт
npx tsx src/cli/index.ts generate create <id-модели> --prompt "кот в красном свитере" --wait

# Модели: npx tsx src/cli/index.ts models list --json
```

Nullume одновременно CLI (командная строка), MCP-сервер (интеграция с Claude Code) и скилл для автоматизации. Подробнее в [`tools/nullume/README.md`](tools/nullume/README.md).

## Структура

```
.claude/              # Агенты, команды, скиллы, хуки, проверки
docs/
  core/               # Универсальные правила (дизайн, код, безопасность)
  projects/           # Реестр и документация проектов
    .active           # Активный проект (одна строка)
    README.md         # Реестр и карта репозитория
    <проект>/
      project.md      # Контекст, стек, ветка, выкатка
      brand.md        # Бренд, тон, палитра
  decisions/          # Архитектурные решения (ADR)
  archive/            # Память между сессиями
projects/             # Код всех проектов (Симба, HB, Perfect Skin, Стройматериалы)
tools/                # Инструменты (Nullume, MCP для иконок)
```

## Одна рабочая ветка

Все проекты работают в единой ветке репозитория: [`claude/greeting-nnz368`](../../tree/claude/greeting-nnz368). Новых веток не создавать. Лишние ветки удаляются в GitHub; хук при старте сессии их перечисляет.

Каждый проект публикуется в своей ветке выкатки (имя в его `project.md` и в реестре выше) — туда только вливается рабочая ветка, сам пуш запускает деплой.
