import { z } from "zod";
import { Importer, ImportRunOptions, RefCandidate } from "../types.js";
import { assertLocalOnlyAllowed, LOCAL_ONLY_WARNING } from "../gate.js";
import { readSession } from "../../sessions.js";
import { UsageError, ProviderError } from "../../../core/errors.js";
import { sleep } from "../http.js";
import { getImporterSetting } from "../../../core/config.js";

/**
 * Dribbble API shot response
 */
const DribbbleShotSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  html_url: z.string().url(),
  tags: z.array(z.string()).optional(),
  images: z.object({
    hidpi: z.string().url().optional(),
    normal: z.string().url().optional(),
  }),
});

type DribbbleShot = z.infer<typeof DribbbleShotSchema>;

/**
 * Dribbble импортёр для собственных шотов
 */
export const dribbbleImporter: Importer = {
  id: "dribbble",
  kind: "local-only",
  title: "Dribbble (собственные шоты)",
  description: `Импорт ваших собственных шотов с Dribbble API v2.
Требует: ~/.nullume/sessions/dribbble.json с токеном или переменная DRIBBBLE_ACCESS_TOKEN`,

  async configure(config, env) {
    assertLocalOnlyAllowed(config, env);

    // Проверить наличие токена: сессия или env
    const tokenFromSession = await readSession("dribbble").catch(() => null);
    const tokenFromEnv = env.DRIBBBLE_ACCESS_TOKEN;

    if (!tokenFromSession && !tokenFromEnv) {
      throw new UsageError(
        `Dribbble токен не найден.\n` +
          `Либо создайте ~/.nullume/sessions/dribbble.json:

{
  "token": "<your_access_token>",
  "createdAt": "2026-09-21T00:00:00Z"
}

Либо установите env DRIBBBLE_ACCESS_TOKEN=<your_token>\n${LOCAL_ONLY_WARNING}`
      );
    }
  },

  async *run(opts) {
    assertLocalOnlyAllowed(opts.config, opts.env);
    opts.log("LOCAL_ONLY_WARNING: Dribbble импортирует только ваши собственные шоты");

    // Получить токен: сессия или env
    let token: string | undefined;

    try {
      const session = await readSession("dribbble");
      token = session.token;
    } catch {
      // fallback на env
    }

    if (!token) {
      token = getImporterSetting(opts.config, "dribbble", "token", "DRIBBBLE_ACCESS_TOKEN");
    }

    if (!token) {
      throw new UsageError(
        `Dribbble токен не найден ни в ~/.nullume/sessions/dribbble.json ни в DRIBBBLE_ACCESS_TOKEN`
      );
    }

    const fetchImpl = opts.fetchImpl ?? fetch;
    let page = 1;
    const perPage = 100;
    let candidateCount = 0;

    opts.log(`DRIBBBLE_QUERY_START`);

    while (true) {
      if (page > 1) {
        const delay = opts.env.NULLUME_NO_DELAY === "1" ? 0 : 1500;
        if (delay > 0) await sleep(delay);
      }

      opts.log(`DRIBBBLE_PAGE page=${page}`);

      // Выполнить запрос к API v2
      const url = `https://api.dribbble.com/v2/user/shots?page=${page}&per_page=${perPage}`;

      const resp = await fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Обработить статусы
      if (resp.status === 403 || resp.status === 429) {
        throw new ProviderError(
          `Dribbble ограничил доступ (${resp.status}). Подожди и повтори.`,
          resp.status
        );
      }

      if (!resp.ok) {
        throw new ProviderError(`HTTP ${resp.status} при запросе к Dribbble`, resp.status);
      }

      // Распарсить ответ
      let shots: DribbbleShot[];
      try {
        const data = await resp.json();
        shots = Array.isArray(data) ? data : [];
      } catch (e) {
        throw new ProviderError(`Не удалось распарсить ответ Dribbble: ${(e as Error).message}`);
      }

      // Валидировать каждый шот
      for (const rawShot of shots) {
        if (opts.signal?.aborted) break;

        let shot: DribbbleShot;
        try {
          shot = DribbbleShotSchema.parse(rawShot);
        } catch (e) {
          opts.log(`DRIBBBLE_SKIP_INVALID id="${rawShot.id}"`);
          continue;
        }

        // Найти изображение: приоритет hidpi > normal
        const imageUrl = shot.images.hidpi || shot.images.normal;
        if (!imageUrl) {
          opts.log(`DRIBBBLE_SKIP_NO_IMAGE id="${shot.id}"`);
          continue;
        }

        const candidate: RefCandidate = {
          url: imageUrl,
          pageUrl: shot.html_url,
          author: "me",
          license: "own work",
          source: "dribbble",
          sourceRef: String(shot.id),
          tags: shot.tags || [],
          meta: {
            title: shot.title,
            description: shot.description,
          },
        };

        yield candidate;
        candidateCount++;

        if (opts.limit > 0 && candidateCount >= opts.limit) {
          opts.log(`DRIBBBLE_LIMIT_REACHED limit=${opts.limit}`);
          return;
        }
      }

      // Пагинация
      if (shots.length < perPage) {
        opts.log(`DRIBBBLE_DONE page=${page} total=${shots.length}`);
        break;
      }

      page++;
    }
  },
};
