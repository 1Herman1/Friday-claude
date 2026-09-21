import fs from "node:fs";
import path from "node:path";
import { ConfigError, ProviderError } from "../../../core/errors.js";
import { getImporterSetting } from "../../../core/config.js";
import { Importer, ImportRunOptions, RefCandidate } from "../types.js";
import { importerFetchJson } from "../http.js";

interface EagleItem {
  id: string;
  name: string;
  ext: string;
  tags?: string[];
  folders?: string[];
  url?: string;
  palettes?: Array<{ color: [number, number, number]; ratio: number }>;
  width?: number;
  height?: number;
}

interface EagleListResponse {
  data: EagleItem[];
  data_count: number;
  total_count: number;
}

interface EagleInfoResponse {
  data: {
    library: {
      path: string;
    };
  };
}

export const eagleImporter: Importer = {
  id: "eagle",
  kind: "clean",
  title: "Eagle.cool",
  description: "Импорт изображений из локального приложения Eagle.cool по API",

  async configure(config, env): Promise<void> {
    const url = getImporterSetting(config, "eagle", "url", "EAGLE_URL") || "http://localhost:41595";

    // Проверить что URL только loopback (исключение из https-only правила)
    try {
      const urlObj = new URL(url);
      const host = urlObj.hostname;
      if (host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]") {
        throw new ConfigError(
          `Eagle импортёр работает только на localhost, получен: ${host}. Проверьте EAGLE_URL.`
        );
      }
    } catch (e) {
      if (e instanceof ConfigError) throw e;
      throw new ConfigError(`Некорректный URL для Eagle: ${url}`);
    }
  },

  async *run(opts: ImportRunOptions): AsyncIterable<RefCandidate> {
    const { config, env, log, limit, query, collection, fetchImpl, signal } = opts;

    const baseUrl = getImporterSetting(config, "eagle", "url", "EAGLE_URL") || "http://localhost:41595";

    // Получить путь к библиотеке
    let libraryPath: string;
    try {
      const infoResp = await importerFetchJson<EagleInfoResponse>(`${baseUrl}/api/library/info`, {
        fetchImpl,
      });
      libraryPath = infoResp.data.library.path;
    } catch (e) {
      throw new ProviderError(`Не удалось подключиться к Eagle API: ${(e as Error).message}`);
    }

    let offset = 0;
    let foundCount = 0;
    const pageSize = 200;
    const tagFilter = query ? query.toLowerCase().split(/\s+/) : [];

    while (foundCount < limit) {
      try {
        const params = new URLSearchParams({
          limit: String(pageSize),
          offset: String(offset),
        });

        if (query) {
          params.append("keyword", query);
        }

        const resp = await importerFetchJson<EagleListResponse>(
          `${baseUrl}/api/item/list?${params.toString()}`,
          { fetchImpl }
        );

        if (!resp.data || resp.data.length === 0) {
          break;
        }

        for (const item of resp.data) {
          if (foundCount >= limit) break;

          // Фильтр по коллекции (папкам)
          if (collection && (!item.folders || !item.folders.includes(collection))) {
            continue;
          }

          // Фильтр по тегам если задан query
          if (tagFilter.length > 0 && item.tags) {
            const itemTagsLower = item.tags.map((t) => t.toLowerCase());
            const hasMatch = tagFilter.some((tag) => itemTagsLower.some((t) => t.includes(tag)));
            if (!hasMatch) continue;
          }

          // Проверить существование файла
          const filePath = path.join(libraryPath, "images", item.id + ".info", `${item.name}.${item.ext}`);
          try {
            await fs.promises.access(filePath);
          } catch {
            log(`Файл не найден: ${filePath}, пропуск`);
            continue;
          }

          const candidate: RefCandidate = {
            filePath,
            source: "eagle",
            sourceRef: item.id,
            tags: item.tags || [],
            palette: item.palettes || [],
            meta: {
              folders: item.folders || [],
              width: item.width,
              height: item.height,
            },
          };

          if (item.url && item.url.startsWith("https://")) {
            candidate.pageUrl = item.url;
          }

          yield candidate;
          foundCount++;
        }

        offset += pageSize;
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        throw new ProviderError(`Ошибка Eagle API: ${(e as Error).message}`);
      }
    }
  },
};
