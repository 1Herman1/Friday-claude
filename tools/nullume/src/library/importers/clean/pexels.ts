import { RateLimiter } from "../../../core/net.js";
import { getImporterSetting } from "../../../core/config.js";
import { ConfigError, ProviderError, UsageError } from "../../../core/errors.js";
import { Importer, ImportRunOptions, RefCandidate } from "../types.js";
import { importerFetchJson } from "../http.js";

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  avg_color: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  alt: string;
}

interface PexelsResponse {
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  total_results: number;
  next_page?: string;
}

const pexelsLimiter = new RateLimiter(200, 60 * 60 * 1000); // 200 requests per hour

export const pexels: Importer = {
  id: "pexels",
  kind: "clean",
  title: "Pexels",
  description:
    "Бесплатная стоковая фотография от сообщества Pexels. " +
    "Требует API-ключ. Получить на https://www.pexels.com/api/",

  async configure(config, env) {
    const key = getImporterSetting(config, "pexels", "key", "PEXELS_API_KEY");
    if (!key) {
      throw new ConfigError(
        "API-ключ Pexels не найден. " +
        "Получи на https://www.pexels.com/api и установи PEXELS_API_KEY или " +
        "добавь в ~/.nullume/config.json: { \"importers\": { \"pexels\": { \"key\": \"YOUR_KEY\" } } }"
      );
    }
  },

  async *run(opts: ImportRunOptions) {
    const { query, limit, fetchImpl, signal, log, config } = opts;

    if (!query) {
      throw new UsageError("Pexels требует --query для поиска фотографий");
    }

    const key = getImporterSetting(config, "pexels", "key", "PEXELS_API_KEY");
    if (!key) {
      throw new ConfigError("API-ключ Pexels не найден");
    }

    let page = 1;
    let collected = 0;
    const perPage = 80;

    while (collected < limit) {
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`;

      try {
        const response = await importerFetchJson<PexelsResponse>(url, {
          fetchImpl,
          limiter: pexelsLimiter,
          headers: {
            Authorization: key,
          },
        });

        if (!response.photos || response.photos.length === 0) {
          break;
        }

        for (const photo of response.photos) {
          if (collected >= limit) break;

          try {
            const candidate: RefCandidate = {
              url: photo.src.large2x,
              pageUrl: photo.url,
              author: photo.photographer,
              license: "Pexels License",
              source: "pexels",
              sourceRef: String(photo.id),
              tags: [],
              meta: {
                alt: photo.alt,
                avg_color: photo.avg_color,
                width: photo.width,
                height: photo.height,
                photographer_url: photo.photographer_url,
              },
            };

            yield candidate;
            collected++;
          } catch (e) {
            log(`Ошибка при обработке фото ${photo.id}: ${(e as Error).message}`);
          }
        }

        if (response.photos.length < perPage) {
          break;
        }

        page++;
      } catch (e) {
        if (e instanceof Error) {
          if (e.message.includes("HTTP 401") || e.message.includes("HTTP 403")) {
            throw new ProviderError(`Ошибка аутентификации Pexels: неверный API-ключ или доступ запрещён`);
          }
          if (e.message.includes("HTTP 429")) {
            throw new ProviderError(`Лимит запросов Pexels (200/час) превышен. Повтори через час.`);
          }
        }
        throw e;
      }
    }
  },
};
