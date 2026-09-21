import { ProviderError, UsageError } from "../../../core/errors.js";
import { getImporterSetting } from "../../../core/config.js";
import { Importer, ImportRunOptions, RefCandidate } from "../types.js";
import { importerFetchJson } from "../http.js";

interface ArenaImageData {
  large?: {
    url?: string;
  };
  display?: {
    url?: string;
  };
}

interface ArenaBlock {
  id: number;
  class: string;
  title?: string;
  image?: ArenaImageData;
  user?: {
    full_name?: string;
  };
  channel_title?: string;
}

interface ArenaChannelResponse {
  contents: ArenaBlock[];
  length: number;
  current_page: number;
  per: number;
  total_count: number;
}

interface ArenaSearchResponse {
  results: ArenaBlock[];
  current_page: number;
  per_page: number;
  total_count: number;
}

export const arenaImporter: Importer = {
  id: "arena",
  kind: "clean",
  title: "Are.na",
  description: "Импорт изображений из канала Are.na (v2 API) или поиск по запросу",

  async configure(config): Promise<void> {
    // Проверить токен если он задан
    const token = getImporterSetting(config, "arena", "token", "ARENA_TOKEN");
    if (token && typeof token !== "string") {
      throw new ProviderError(`ARENA_TOKEN должен быть строкой`);
    }
  },

  async *run(opts: ImportRunOptions): AsyncIterable<RefCandidate> {
    const { log, limit, collection, query, fetchImpl, config } = opts;
    const token = getImporterSetting(config, "arena", "token", "ARENA_TOKEN");

    // Заголовок Authorization если есть токен
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let foundCount = 0;
    let page = 1;
    const perPage = 50;

    try {
      while (foundCount < limit) {
        let blocks: ArenaBlock[] = [];
        let totalCount = 0;

        if (collection) {
          // Режим канала
          const url = `https://api.are.na/v2/channels/${encodeURIComponent(collection)}/contents?page=${page}&per=${perPage}`;
          const resp = await importerFetchJson<ArenaChannelResponse>(url, { fetchImpl, headers });

          blocks = resp.contents || [];
          totalCount = resp.total_count || 0;
        } else if (query) {
          // Режим поиска
          const url = `https://api.are.na/v2/search/blocks?q=${encodeURIComponent(query)}&page=${page}&per=${perPage}`;
          const resp = await importerFetchJson<ArenaSearchResponse>(url, { fetchImpl, headers });

          blocks = resp.results || [];
          totalCount = resp.total_count || 0;
        } else {
          throw new UsageError(
            `Укажите --collection <channelSlug> или --query <searchTerm>`
          );
        }

        if (blocks.length === 0) {
          break;
        }

        for (const block of blocks) {
          if (foundCount >= limit) break;

          // Фильтр: только Image блоки
          if (block.class !== "Image") {
            continue;
          }

          // Проверить картинку
          const imageUrl = block.image?.large?.url || block.image?.display?.url;
          if (!imageUrl || !imageUrl.startsWith("https://")) {
            continue;
          }

          const candidate: RefCandidate = {
            url: imageUrl,
            pageUrl: `https://www.are.na/block/${block.id}`,
            author: block.user?.full_name,
            license: "unknown (Are.na user content)",
            source: "arena",
            sourceRef: String(block.id),
            tags: [],
            meta: {
              title: block.title,
              channel: block.channel_title,
            },
          };

          yield candidate;
          foundCount++;
        }

        // Проверить наличие следующей страницы
        if (blocks.length < perPage || foundCount >= totalCount) {
          break;
        }

        page++;
      }
    } catch (e) {
      if (e instanceof UsageError) throw e;
      throw new ProviderError(`Ошибка Are.na API: ${(e as Error).message}`);
    }
  },
};
