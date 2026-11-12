# Этап 01 — устранение падения каталога

Задание 12.11.2026. Статус: исправление и независимая локальная проверка выполнены; финальное ревью/публикация ещё не завершены.

## Причина и scope

`CatalogPage.tsx` использовал разные наборы React hooks для index и listing. При SPA-переходе `/catalog` → `/catalog/all` нарушался порядок hooks: dev «Rendered more hooks than during the previous render», production React #310; React root становился пустым. Reload монтировал listing заново, обходя дефект.

Основной агент независимо воспроизвёл это как локально в WebKit (RED), так и на текущем HTTP-стенде Chromium: после клика root=0, React #310. Это не гипотеза по скриншоту.

Исправление: module-level `CatalogIndex` и `CatalogListing` в прежнем файле, постоянные hooks у каждого. Общая pro-проверка остаётся в `CatalogPage`. Дизайн, фильтры, названия и маршруты не менялись. Остальные пункты desktop-ТЗ не выполнялись.

## Проверки основного агента

- Прочитан полный diff TSX и новый тест `client/tests/catalog-navigation.mjs`.
- Повторён RED до исправления, exit 1 с hooks error; после исправления исходный repro GREEN, root=1, заголовок/товары доступны без reload.
- Локальная production-сборка: полный обход 11 плиток в Chromium и WebKit; back/forward и повторный index → all → back; `documentRequests: 1`, `errors: []`, exit 0.
- Повторена сборка snapshot-копии: `tsc --noEmit && vite build`, exit 0.
- Повторены ingredient-icon/snapshot-parity тесты: 24 pass, 0 fail, 22 skipped (нет локального API). Пропуски не являются успешной API-проверкой.
- Просмотрен фактический screenshot после перехода: каталог, фильтры и товары отображаются, пустого экрана нет.
- Старые предупреждения fetchPriority, Router future flags и Vite snapshot-import не относятся к исправлению и не скрываются.

## Воспроизводимость

Тест запускается против локального `VITE_API_MODE=snapshot` dev или production-preview:

```sh
PS_E2E_BASE_URL=http://127.0.0.1:5188 ENGINE=webkit node projects/perfect-skin/client/tests/catalog-navigation.mjs
```

При внешней установке Playwright передать `PLAYWRIGHT_MODULE` с абсолютным путём к `playwright-core/index.mjs`. Браузеры устанавливать в отдельный `PLAYWRIGHT_BROWSERS_PATH` с `PLAYWRIGHT_SKIP_BROWSER_GC=1`, не очищая общий кеш.

Артефакты данной сессии локально: `~/.hermes/cache/scratch/ps-catalog-stage1/` (`result-parent-red.json`, `result-parent-green.json`, `after-parent-green.png`, `live-before-fix.json`, `live-before-fix.png`). WebKit не равен установленному Safari; проверка нативного Safari пока не выполнена.

## Оставшиеся действия

- Независимое финальное code review.
- Коммит/пуш и публикация исправления на существующий стенд, без переключения домена.
- После публикации повторить read-only SPA-навигацию с реальным API; отдельно проверить прокрутку и UI на разных desktop-ширинах.
- Не закрывать пункт 01 только по локальной сборке.
