import { ConfigError, ProviderError } from "../../../core/errors.js";
import { getImporterSetting } from "../../../core/config.js";
import { Importer, ImportRunOptions, RefCandidate } from "../types.js";
import { importerFetchJson } from "../http.js";

interface PinterestImage {
  url?: string;
}

interface PinterestPin {
  id: string;
  title?: string;
  description?: string;
  alt_text?: string;
  creative_type?: string;
  media: {
    images?: {
      "1200x"?: PinterestImage;
      "600x"?: PinterestImage;
    };
  };
}

interface PinterestPinsResponse {
  items: PinterestPin[];
  bookmark?: string;
}

interface PinterestBoard {
  id: string;
  name: string;
}

interface PinterestBoardsResponse {
  items: PinterestBoard[];
  bookmark?: string;
}

export const pinterestApiImporter: Importer = {
  id: "pinterest-api",
  kind: "clean",
  title: "Pinterest API",
  description: "Импорт пинов из Pinterest API v5",

  async configure(config, env): Promise<void> {
    const token = getImporterSetting(config, "pinterest", "accessToken", "PINTEREST_ACCESS_TOKEN");
    if (!token) {
      throw new ConfigError(
        `Требуется access token Pinterest API. Получите токен на developer.pinterest.com, затем установите PINTEREST_ACCESS_TOKEN.`
      );
    }
  },

  async *run(opts: ImportRunOptions): AsyncIterable<RefCandidate> {
    const { config, log, limit, collection, fetchImpl } = opts;

    const token = getImporterSetting(config, "pinterest", "accessToken", "PINTEREST_ACCESS_TOKEN");
    if (!token) {
      throw new ProviderError("Pinterest access token не найден");
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    // Если не передана коллекция — вывести список досок
    if (!collection) {
      try {
        let hasMore = true;
        let bookmark: string | undefined;
        const boardList: Array<{ id: string; name: string }> = [];

        while (hasMore) {
          const params = new URLSearchParams({
            page_size: "25",
          });

          if (bookmark) {
            params.append("bookmark", bookmark);
          }

          const resp = await importerFetchJson<PinterestBoardsResponse>(
            `https://api.pinterest.com/v5/boards?${params.toString()}`,
            { fetchImpl, headers }
          );

          if (resp.items) {
            boardList.push(...resp.items);
          }

          bookmark = resp.bookmark;
          hasMore = !!bookmark;
        }

        log("Доступные доски Pinterest:");
        for (const board of boardList) {
          log(`  ${board.name} (ID: ${board.id})`);
        }

        log(`\nИспользуйте --collection <board_id> для импорта пинов из конкретной доски`);
        return;
      } catch (e) {
        const errorMsg = (e as Error).message;
        if (errorMsg.includes("401") || errorMsg.includes("403")) {
          throw new ProviderError(`Ошибка авторизации Pinterest: проверьте access token`);
        }
        throw new ProviderError(`Ошибка Pinterest API при получении досок: ${errorMsg}`);
      }
    }

    // Импорт пинов из доски
    let foundCount = 0;
    let bookmark: string | undefined;

    while (foundCount < limit) {
      try {
        const params = new URLSearchParams({
          page_size: "50",
        });

        if (bookmark) {
          params.append("bookmark", bookmark);
        }

        const resp = await importerFetchJson<PinterestPinsResponse>(
          `https://api.pinterest.com/v5/boards/${collection}/pins?${params.toString()}`,
          { fetchImpl, headers }
        );

        if (!resp.items || resp.items.length === 0) {
          break;
        }

        for (const pin of resp.items) {
          if (foundCount >= limit) break;

          // Получить изображение: предпочтительно 1200x, если нет — 600x
          let imageUrl: string | undefined;

          if (pin.media?.images?.["1200x"]?.url) {
            imageUrl = pin.media.images["1200x"].url;
          } else if (pin.media?.images?.["600x"]?.url) {
            imageUrl = pin.media.images["600x"].url;
          }

          // Пропустить пины без изображения
          if (!imageUrl) {
            log(`Pin без изображения, пропуск: ${pin.id}`);
            continue;
          }

          const candidate: RefCandidate = {
            url: imageUrl,
            pageUrl: `https://www.pinterest.com/pin/${pin.id}/`,
            source: "pinterest-api",
            sourceRef: pin.id,
            tags: [],
            meta: {
              title: pin.title,
              description: pin.description,
              alt_text: pin.alt_text,
              board_id: collection,
            },
          };

          yield candidate;
          foundCount++;
        }

        bookmark = resp.bookmark;
        if (!bookmark) {
          break;
        }
      } catch (e) {
        const errorMsg = (e as Error).message;
        if (errorMsg.includes("401") || errorMsg.includes("403")) {
          throw new ProviderError(`Ошибка авторизации Pinterest: проверьте access token`);
        }
        throw new ProviderError(`Ошибка Pinterest API: ${errorMsg}`);
      }
    }
  },
};
