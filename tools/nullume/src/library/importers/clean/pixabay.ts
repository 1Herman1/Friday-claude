import { createHash } from "node:crypto";
import { RateLimiter } from "../../../core/net.js";
import { getImporterSetting } from "../../../core/config.js";
import { ConfigError, ProviderError, UsageError } from "../../../core/errors.js";
import { Importer, ImportRunOptions, RefCandidate } from "../types.js";
import { importerFetchJson } from "../http.js";

interface PixabayHit {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  previewURL: string;
  previewWidth: number;
  previewHeight: number;
  webformatURL: string;
  webformatWidth: number;
  webformatHeight: number;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  imageSize: number;
  views: number;
  downloads: number;
  favorites: number;
  likes: number;
  comments: number;
  user_id: number;
  user: string;
  userImageURL: string;
}

interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayHit[];
}

const pixabayLimiter = new RateLimiter(100, 60 * 1000); // 100 requests per minute

export const pixabay: Importer = {
  id: "pixabay",
  kind: "clean",
  title: "Pixabay",
  description:
    "Бесплатная стоковая фотография от сообщества Pixabay. " +
    "Требует API-ключ. Получить на https://pixabay.com/api/docs/",

  async configure(config, env) {
    const key = getImporterSetting(config, "pixabay", "key", "PIXABAY_API_KEY");
    if (!key) {
      throw new ConfigError(
        "API-ключ Pixabay не найден. " +
        "Получи на https://pixabay.com/api/docs/ и установи PIXABAY_API_KEY или " +
        "добавь в ~/.nullume/config.json: { \"importers\": { \"pixabay\": { \"key\": \"YOUR_KEY\" } } }"
      );
    }
  },

  async *run(opts: ImportRunOptions) {
    const { query, limit, fetchImpl, signal, log, config } = opts;

    if (!query) {
      throw new UsageError("Pixabay требует --query для поиска фотографий");
    }

    const key = getImporterSetting(config, "pixabay", "key", "PIXABAY_API_KEY");
    if (!key) {
      throw new ConfigError("API-ключ Pixabay не найден");
    }

    let page = 1;
    let collected = 0;
    const perPage = 100;

    while (collected < limit) {
      const baseUrl = `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&image_type=photo&per_page=${perPage}&page=${page}&safesearch=true`;

      // Cache key: URL without the API key
      const cacheKeyUrl = `https://pixabay.com/api/?q=${encodeURIComponent(query)}&image_type=photo&per_page=${perPage}&page=${page}&safesearch=true`;
      const hash = createHash("sha1").update(cacheKeyUrl).digest("hex");
      const cacheKey = `pixabay-${hash}`;

      try {
        const response = await importerFetchJson<PixabayResponse>(baseUrl, {
          fetchImpl,
          limiter: pixabayLimiter,
          cacheKey,
          ttlMs: 24 * 60 * 60 * 1000, // 24 hours - required by ToS
        });

        if (!response.hits || response.hits.length === 0) {
          break;
        }

        for (const hit of response.hits) {
          if (collected >= limit) break;

          try {
            const candidate: RefCandidate = {
              url: hit.largeImageURL,
              pageUrl: hit.pageURL,
              author: hit.user,
              license: "Pixabay Content License",
              source: "pixabay",
              sourceRef: String(hit.id),
              tags: hit.tags
                .split(",")
                .map((t) => t.trim())
                .filter((t) => t.length > 0),
              meta: {
                width: hit.imageWidth,
                height: hit.imageHeight,
              },
            };

            yield candidate;
            collected++;
          } catch (e) {
            log(`Ошибка при обработке фото ${hit.id}: ${(e as Error).message}`);
          }
        }

        if (response.hits.length < perPage) {
          break;
        }

        page++;
      } catch (e) {
        if (e instanceof Error) {
          if (e.message.includes("HTTP 401") || e.message.includes("HTTP 403")) {
            throw new ProviderError(`Ошибка аутентификации Pixabay: неверный API-ключ или доступ запрещён`);
          }
          if (e.message.includes("HTTP 429")) {
            throw new ProviderError(`Лимит запросов Pixabay (100/мин) превышен. Повтори через минуту.`);
          }
        }
        throw e;
      }
    }
  },
};
