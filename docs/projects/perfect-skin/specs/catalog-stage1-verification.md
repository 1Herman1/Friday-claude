# Этап 01 — устранение падения каталога

Задание 12.11.2026. Статус: исправление опубликовано на существующем стенде и независимо проверено основным агентом в Chromium и Playwright WebKit. Нативный установленный Safari отдельно не проверен.

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

## Публикация и проверка стенда

- Независимое code review: passed=true, security_concerns=[], logic_errors=[]. Дополнительные сценарии query/pro/listing→listing предложены как расширение покрытия, не как найденная регрессия. Основной агент дополнительно прочитал diff и тест.
- Коммит исправления `02ce2d9693dfce6782c8cdfe2fef8e7f55dbad7e` отправлен в рабочую ветку и `deploy/perfect-skin`; совпадение remote SHA прочитано через `git ls-remote`.
- Новый реально отдаваемый bundle `/assets/index-q-cfeocT.js` заменил `/assets/index-B0k4nqO4.js`; проверка сделана браузером с реальным API, не snapshot.
- На живом стенде 9 отображаемых плиток (локальный snapshot содержит 11). Все 9 пройдены в Chromium и WebKit с back/forward и повторными входами; `documents:1`, runtime errors отсутствуют.
- На ширинах 1280, 1440, 1920 проверены товары, прокрутка и screenshot: scrollY после wheel=650; каталог не перекрыт и не пуст.
- Первый live WebKit-прогон остановился по timeout ожидания index после нескольких переходов, без React error. Следующий полный прогон прошёл; точная причина первого timeout не установлена, её не выдаём за устранённый отдельный баг. В повторе единственный HTTP>=400 — ожидаемый гостевой `/api/v1/auth/me` 401.
- Полный статус GitHub Actions через API не прочитан: нет API credentials, git SSH доступ отдельно работает. Успешная публикация UI подтверждена изменённым живым bundle и функциональной проверкой, не утверждением о статусе CI.
- Нативный Safari пользователя не проверен. Playwright WebKit — самостоятельная проверка движка, не доказательство работы конкретного пользовательского профиля.
- Проверки read-only: не оформляли заказы, не меняли корзину, БД, домен, почту или вход.

Файлы live-проверки: `verify-live.mjs`, `live-fixed-chromium.json`, `live-fixed-webkit.json`, `live-fixed-{engine}-{width}.png` в той же scratch-папке.

## Остаточные ограничения

- При повторении пользовательского зависания в нативном Safari нужно получить его console/network и повторить именно этот путь. Подтверждённое падение React #310 устранено и больше не воспроизводится в проверенных сценариях.
- Заголовки и дизайн пока прежние: это этап 02. Остальные ошибки (корзина, избранное, поиск) не объявляются исправленными.
