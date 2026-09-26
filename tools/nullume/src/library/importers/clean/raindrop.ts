import { ConfigError, ProviderError } from "../../../core/errors.js";
import { getImporterSetting } from "../../../core/config.js";
import { Importer, ImportRunOptions, RefCandidate } from "../types.js";
import { importerFetchJson } from "../http.js";
import { RateLimiter } from "../../../core/net.js";

interface RaindropItem {
  _id: number;
  link: string;
  cover?: string;
  domain: string;
  tags: string[];
  title?: string;
  excerpt?: string;
  type?: string;
}

interface RaindropResponse {
  result: boolean;
  items: RaindropItem[];
  count: number;
}

export const raindropImporter: Importer = {
  id: "raindrop",
  kind: "clean",
  supportsQuery: true,
  title: "Raindrop.io",
  description: "Импорт закладок изображений из Raindrop.io",

  async configure(config, env): Promise<void> {
    const token = getImporterSetting(config, "raindrop", "token", "RAINDROP_TOKEN");
    if (!token) {
      throw new ConfigError(
        `Требуется токен Raindrop.io. Получите токен на app.raindrop.io/settings/integrations → Test token, затем установите RAINDROP_TOKEN.`
      );
    }
  },

  async *run(opts: ImportRunOptions): AsyncIterable<RefCandidate> {
    const { config, log, limit, query, collection, fetchImpl } = opts;

    const token = getImporterSetting(config, "raindrop", "token", "RAINDROP_TOKEN");
    if (!token) {
      throw new ProviderError("Токен Raindrop.io не найден");
    }

    const limiter = new RateLimiter(120, 60000); // 120 запросов в минуту
    const headers = {
      Authorization: `Bearer ${token}`,
    };

    let foundCount = 0;
    let page = 0;
    const pageSize = 50;
    const collectionId = collection ? (isNaN(Number(collection)) ? 0 : Number(collection)) : 0;

    while (foundCount < limit) {
      try {
        const params = new URLSearchParams({
          page: String(page),
          perpage: String(pageSize),
        });

        if (query) {
          params.append("search", query);
        }

        const resp = await importerFetchJson<RaindropResponse>(
          `https://api.raindrop.io/rest/v1/raindrops/${collectionId}?${params.toString()}`,
          { fetchImpl, limiter, headers }
        );

        if (!resp.result || !resp.items || resp.items.length === 0) {
          break;
        }

        for (const item of resp.items) {
          if (foundCount >= limit) break;

          // Пропустить если нет изображения
          if (!item.cover) {
            log(`Раздроп без cover, пропуск: ${item.link}`);
            continue;
          }

          const candidate: RefCandidate = {
            url: item.cover,
            pageUrl: item.link,
            author: item.domain,
            source: "raindrop",
            sourceRef: String(item._id),
            tags: item.tags || [],
            meta: {
              title: item.title,
              excerpt: item.excerpt,
              type: item.type,
            },
          };

          yield candidate;
          foundCount++;
        }

        page++;
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        const errorMsg = (e as Error).message;
        if (errorMsg.includes("401") || errorMsg.includes("403")) {
          throw new ProviderError(`Ошибка авторизации Raindrop: проверьте токен`);
        }
        throw new ProviderError(`Ошибка Raindrop API: ${errorMsg}`);
      }
    }
  },
};
