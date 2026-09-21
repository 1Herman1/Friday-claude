import { ProviderError, UsageError } from "../../../core/errors.js";
import { Importer, ImportRunOptions, RefCandidate } from "../types.js";
import { importerFetchJson } from "../http.js";

interface CivitaiImageMeta {
  prompt?: string;
  negativePrompt?: string;
  Model?: string;
  width?: number;
  height?: number;
}

interface CivitaiImage {
  id: number;
  url: string;
  username?: string;
  meta?: CivitaiImageMeta;
  nsfwLevel?: "None" | "Soft" | "Moderate" | "X";
  width?: number;
  height?: number;
}

interface CivitaiResponse {
  items: CivitaiImage[];
  metadata: {
    nextCursor?: string;
  };
}

export const civitaiImporter: Importer = {
  id: "civitai",
  kind: "clean",
  title: "Civitai",
  description: "Импорт изображений с Civitai (AI-generated artwork) по рейтингам",

  async configure(): Promise<void> {
    // Нет конфигурации
  },

  async *run(opts: ImportRunOptions): AsyncIterable<RefCandidate> {
    const { log, limit, query, fetchImpl } = opts;

    let foundCount = 0;
    let cursor: string | undefined;

    try {
      while (foundCount < limit) {
        // Строим URL с базовыми параметрами
        const params = new URLSearchParams({
          limit: "100",
          sort: "Most Reactions",
          nsfw: "false",
          period: "Month",
        });

        if (cursor) {
          params.append("cursor", cursor);
        }

        const url = `https://civitai.com/api/v1/images?${params.toString()}`;
        const resp = await importerFetchJson<CivitaiResponse>(url, { fetchImpl });

        const items = resp.items || [];

        if (items.length === 0) {
          break;
        }

        for (const item of items) {
          if (foundCount >= limit) break;

          // Фильтр: только nsfw='None'
          if (item.nsfwLevel && item.nsfwLevel !== "None") {
            continue;
          }

          // Фильтр по query (поиск в prompt, регистр не важен)
          if (query) {
            const promptText = (item.meta?.prompt || "").toLowerCase();
            if (!promptText.includes(query.toLowerCase())) {
              continue;
            }
          }

          // Проверить URL
          if (!item.url || !item.url.startsWith("https://")) {
            continue;
          }

          const candidate: RefCandidate = {
            url: item.url,
            pageUrl: `https://civitai.com/images/${item.id}`,
            author: item.username,
            license: "unknown (Civitai user content)",
            source: "civitai",
            sourceRef: String(item.id),
            tags: [],
            meta: {
              prompt: item.meta?.prompt,
              negativePrompt: item.meta?.negativePrompt,
              model: item.meta?.Model,
              width: item.width,
              height: item.height,
              nsfwLevel: item.nsfwLevel,
            },
          };

          yield candidate;
          foundCount++;
        }

        // Пагинация
        cursor = resp.metadata?.nextCursor;
        if (!cursor) {
          break;
        }
      }
    } catch (e) {
      throw new ProviderError(`Ошибка Civitai API: ${(e as Error).message}`);
    }
  },
};
