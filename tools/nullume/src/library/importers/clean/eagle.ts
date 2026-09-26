import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ConfigError, ProviderError } from "../../../core/errors.js";
import { getImporterSetting } from "../../../core/config.js";
import { Importer, ImportRunOptions, RefCandidate } from "../types.js";
import { importerFetchJson, yieldValid } from "../http.js";

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

const EagleItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  ext: z.string(),
  tags: z.array(z.string()).optional(),
  folders: z.array(z.string()).optional(),
  url: z.string().optional(),
  palettes: z.array(z.object({ color: z.tuple([z.number(), z.number(), z.number()]), ratio: z.number() })).optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const EagleListResponseSchema = z.object({
  data: z.array(EagleItemSchema),
  data_count: z.number(),
  total_count: z.number(),
});

interface EagleListResponse extends z.infer<typeof EagleListResponseSchema> {}

const EagleInfoResponseSchema = z.object({
  data: z.object({
    library: z.object({
      path: z.string(),
    }),
  }),
});

interface EagleInfoResponse extends z.infer<typeof EagleInfoResponseSchema> {}

/**
 * Проверить что URL является loopback адресом
 * Поддерживает: localhost, 127.0.0.1, ::1
 */
function assertEagleLoopback(url: string): void {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1") {
      throw new ConfigError(
        `Eagle импортёр работает только на localhost, получен: ${hostname}. Проверьте EAGLE_URL.`
      );
    }
  } catch (e) {
    if (e instanceof ConfigError) throw e;
    throw new ConfigError(`Некорректный URL для Eagle: ${url}`);
  }
}

export const eagleImporter: Importer = {
  id: "eagle",
  kind: "clean",
  supportsQuery: true,
  title: "Eagle.cool",
  description: "Импорт изображений из локального приложения Eagle.cool по API",

  async configure(config, env): Promise<void> {
    const url = getImporterSetting(config, "eagle", "url", "EAGLE_URL") || "http://localhost:41595";
    assertEagleLoopback(url);
  },

  async *run(opts: ImportRunOptions): AsyncIterable<RefCandidate> {
    const { config, env, log, limit, query, collection, fetchImpl, signal } = opts;

    // При limit === 0 не запрашивать ничего
    if (limit === 0) {
      return;
    }

    const baseUrl = getImporterSetting(config, "eagle", "url", "EAGLE_URL") || "http://localhost:41595";

    // Проверить loopback перед запросом
    assertEagleLoopback(baseUrl);

    // Получить путь к библиотеке
    let libraryPath: string;
    try {
      const infoResp = await importerFetchJson<EagleInfoResponse>(`${baseUrl}/api/library/info`, {
        fetchImpl,
        allowLoopback: true,
      });
      // Валидировать ответ
      const validated = EagleInfoResponseSchema.parse(infoResp);
      libraryPath = validated.data.library.path;
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
          { fetchImpl, allowLoopback: true }
        );

        // Валидировать ответ
        const validated = EagleListResponseSchema.parse(resp);

        if (!validated.data || validated.data.length === 0) {
          break;
        }

        for (const item of validated.data) {
          if (foundCount >= limit) break;

          // Проверить что id, name, ext не содержат опасных символов
          if (item.id.includes("/") || item.id.includes("\\") || item.id.includes("..")) {
            log(`Пропуск: id содержит опасные символы: ${item.id}`);
            continue;
          }
          if (item.name.includes("/") || item.name.includes("\\") || item.name.includes("..")) {
            log(`Пропуск: name содержит опасные символы: ${item.name}`);
            continue;
          }
          if (item.ext.includes("/") || item.ext.includes("\\") || item.ext.includes("..")) {
            log(`Пропуск: ext содержит опасные символы: ${item.ext}`);
            continue;
          }

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

          // Проверить существование файла с защитой от traversal
          const filePath = path.join(libraryPath, "images", `${item.id}.info`, `${item.name}.${item.ext}`);
          const resolved = path.resolve(filePath);
          const baseResolved = path.resolve(libraryPath);

          // Проверить что путь находится внутри libraryPath
          if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
            log(`Пропуск: path traversal detected: ${item.id}/${item.name}.${item.ext}`);
            continue;
          }

          try {
            await fs.promises.access(resolved);
          } catch {
            log(`Файл не найден: ${resolved}, пропуск`);
            continue;
          }

          const candidate: RefCandidate = {
            filePath: resolved,
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
