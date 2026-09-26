import { z } from "zod";
import { Importer, ImportRunOptions, RefCandidate } from "../types.js";
import { assertLocalOnlyAllowed, LOCAL_ONLY_WARNING } from "../gate.js";
import { readSession, parseCookieFile } from "../../sessions.js";
import { UsageError, ProviderError } from "../../../core/errors.js";
import { sleep } from "../http.js";

/**
 * Pinterest API response schema (базовая структура)
 */
const PinterestResponseSchema = z.object({
  resource_response: z
    .object({
      data: z
        .object({
          results: z
            .array(
              z.object({
                id: z.string(),
                images: z.record(
                  z.string(),
                  z.object({
                    url: z.string().url().optional(),
                  })
                ),
                pinner: z
                  .object({
                    username: z.string(),
                  })
                  .optional(),
                title: z.string().optional(),
                description: z.string().optional(),
                board: z
                  .object({
                    name: z.string(),
                  })
                  .optional(),
              })
            )
            .default([]),
        })
        .optional(),
      bookmark: z.string().optional(),
    })
    .optional(),
});

type PinterestResponse = z.infer<typeof PinterestResponseSchema>;

/**
 * Pinterest импортёр через cookies
 * Требует собственную сессию с _pinterest_sess cookie
 */
export const pinterestCookiesImporter: Importer = {
  id: "pinterest-cookies",
  kind: "local-only",
  title: "Pinterest (поиск по собственной сессии)",
  description: `Поиск пинов через вашу учётную запись Pinterest.
Требует: ~/.nullume/sessions/pinterest-cookies.json с cookies и acknowledgedRiskyImporters=true`,

  async configure(config, env) {
    // Проверить гейт для local-only импортёров
    assertLocalOnlyAllowed(config, env);

    // Попытаться прочитать сессию (новое имя, с запасным)
    let session;
    try {
      session = await readSession("pinterest-cookies");
    } catch (e) {
      // Попробовать старое имя для обратной совместимости
      try {
        session = await readSession("pinterest");
      } catch {
        throw new UsageError(
          `Pinterest сессия не найдена.\n\n` +
            `Создайте сессию командой:\n\n` +
            `  nullume lib session set pinterest-cookies --cookie "_pinterest_sess=ЗНАЧЕНИЕ"\n\n` +
            `Инструкция:\n` +
            `1. Откройте Pinterest в браузере и войдите в аккаунт\n` +
            `2. Откройте Developer Tools (F12)\n` +
            `3. Перейдите на вкладку «Application» (Приложение)\n` +
            `4. В левом меню выберите «Cookies» → pinterest.com\n` +
            `5. Найдите cookie с именем _pinterest_sess\n` +
            `6. Скопируйте её значение\n` +
            `7. Выполните команду выше, заменив ЗНАЧЕНИЕ\n\n` +
            `Дополнительно (опционально):\n` +
            `  --cookie "csrftoken=ЗНАЧЕНИЕ" если нужен CSRF-токен\n\n` +
            `Риск: Pinterest может заблокировать аккаунт за автоматизацию.\n${LOCAL_ONLY_WARNING}`
        );
      }
    }
  },

  async *run(opts) {
    // Повторная проверка гейта перед запуском
    assertLocalOnlyAllowed(opts.config, opts.env);
    opts.log("LOCAL_ONLY_WARNING: Pinterest может заблокировать аккаунт");

    // Попытаться прочитать сессию (новое имя, с запасным)
    let session;
    try {
      session = await readSession("pinterest-cookies");
    } catch (e) {
      // Попробовать старое имя для обратной совместимости
      try {
        session = await readSession("pinterest");
      } catch {
        throw new UsageError(
          `Pinterest сессия не найдена. ` +
            `Выполните: nullume lib session set pinterest-cookies --cookie "_pinterest_sess=ЗНАЧЕНИЕ"`
        );
      }
    }

    if (!session.cookies || !session.cookies._pinterest_sess) {
      throw new UsageError(
        `Pinterest сессия не содержит cookie _pinterest_sess.\n` +
          `Обновите сессию: nullume lib session set pinterest-cookies --cookie "_pinterest_sess=ЗНАЧЕНИЕ"`
      );
    }

    const fetchImpl = opts.fetchImpl ?? fetch;
    const query = opts.query || "design";
    let bookmark = undefined;
    let pageNum = 0;
    let candidateCount = 0;

    opts.log(`PINTEREST_QUERY_START query="${query}"`);

    while (true) {
      if (pageNum > 0) {
        // Задержка >= 1500 мс между страницами
        const delay = opts.env.NULLUME_NO_DELAY === "1" ? 0 : 1500;
        if (delay > 0) await sleep(delay);
      }

      // Построить URL запроса
      const bookmarkParam = bookmark ? `&data=${encodeURIComponent(JSON.stringify({ bookmarks: [bookmark] }))}` : "";
      const url =
        `https://www.pinterest.com/resource/BaseSearchResource/get/` +
        `?source_url=/search/pins/?q=${encodeURIComponent(query)}` +
        `&data=${encodeURIComponent(
          JSON.stringify({
            options: { query, scope: "pins", bookmarks: bookmark ? [bookmark] : [] },
            context: {},
          })
        )}`;

      opts.log(`PINTEREST_PAGE query="${query}" page=${pageNum + 1}`);

      // Выполнить запрос
      const headers: Record<string, string> = {
        cookie: Object.entries(session.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
        "X-Requested-With": "XMLHttpRequest",
      };

      // Добавить X-CSRFToken если есть csrftoken в cookies
      if (session.cookies.csrftoken) {
        headers["X-CSRFToken"] = session.cookies.csrftoken;
      }

      const resp = await fetchImpl(url, { headers });

      // Обработать статусы
      if (resp.status === 401 || resp.status === 403) {
        throw new ProviderError(
          `Pinterest: сессия устарела или недействительна (${resp.status}). ` +
            `Обновите cookie: nullume lib session set pinterest-cookies --cookie "_pinterest_sess=НОВОЕ_ЗНАЧЕНИЕ"`,
          resp.status
        );
      }

      if (resp.status === 429) {
        throw new ProviderError(
          `Pinterest ограничил доступ (${resp.status}). Подожди и повтори; продолжение грозит блокировкой аккаунта.`,
          resp.status
        );
      }

      if (!resp.ok) {
        throw new ProviderError(`HTTP ${resp.status} при запросе к Pinterest`, resp.status);
      }

      // Распарсить ответ
      let rawData: unknown;
      try {
        rawData = await resp.json();
      } catch (e) {
        throw new ProviderError(
          `Не удалось распарсить ответ Pinterest: ${(e as Error).message}. ` +
            `Формат ответа Pinterest изменился.`
        );
      }

      // Валидировать
      let data: PinterestResponse;
      try {
        data = PinterestResponseSchema.parse(rawData);
      } catch (e) {
        throw new ProviderError(
          `Формат ответа Pinterest изменился: ${(e as Error).message}`
        );
      }

      // Проверить что response_resource есть
      if (!data.resource_response) {
        throw new ProviderError(
          `Формат ответа Pinterest изменился: отсутствует resource_response`
        );
      }

      // Обработить результаты
      const results = data.resource_response.data?.results ?? [];
      for (const pin of results) {
        if (opts.signal?.aborted) break;

        // Найти изображение
        const images = pin.images || {};
        let imageUrl: string | undefined;

        // Приоритет: original > 736x
        if (images.orig?.url) {
          imageUrl = images.orig.url;
        } else if (images["736x"]?.url) {
          imageUrl = images["736x"].url;
        } else {
          // Пропустить если нет изображения
          opts.log(`PINTEREST_SKIP_NO_IMAGE id="${pin.id}"`);
          continue;
        }

        const candidate: RefCandidate = {
          url: imageUrl,
          pageUrl: `https://www.pinterest.com/pin/${pin.id}/`,
          author: pin.pinner?.username,
          license: "pinterest",
          source: "pinterest-cookies",
          sourceRef: pin.id,
          meta: {
            title: pin.title,
            description: pin.description,
            board: pin.board?.name,
          },
          tags: [],
        };

        yield candidate;
        candidateCount++;

        // Выход если достигли лимита
        if (opts.limit > 0 && candidateCount >= opts.limit) {
          opts.log(`PINTEREST_LIMIT_REACHED limit=${opts.limit}`);
          return;
        }
      }

      // Пагинация
      if (!data.resource_response?.bookmark) {
        opts.log(`PINTEREST_DONE query="${query}" total=${results.length}`);
        break;
      }

      bookmark = data.resource_response.bookmark;
      pageNum++;
    }
  },
};
