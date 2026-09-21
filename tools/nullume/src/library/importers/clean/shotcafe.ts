import { ProviderError, UsageError } from "../../../core/errors.js";
import { Importer, ImportRunOptions, RefCandidate } from "../types.js";
import { importerFetchText, sleep } from "../http.js";

export const shotcafeImporter: Importer = {
  id: "shotcafe",
  kind: "clean",
  title: "Shot.cafe",
  description: "Импорт кадров фильмов и сериалов со Shot.cafe (теги или поиск по цвету)",

  async configure(): Promise<void> {
    // Нет конфигурации
  },

  async *run(opts: ImportRunOptions): AsyncIterable<RefCandidate> {
    const { log, limit, collection, query, fetchImpl, env } = opts;

    const noDelay = env.NULLUME_NO_DELAY === "1";

    if (!collection && !query) {
      throw new UsageError(`Укажите --collection <tag> или --query <color_hex>`);
    }

    let baseUrl: string;
    let identifier: string;

    if (collection) {
      baseUrl = `https://shot.cafe/tags/${encodeURIComponent(collection)}`;
      identifier = collection;
    } else if (query) {
      // query может быть hex цветом, без #
      const colorHex = query.startsWith("#") ? query.slice(1) : query;
      baseUrl = `https://shot.cafe/colors/${encodeURIComponent(colorHex)}`;
      identifier = colorHex;
    } else {
      throw new UsageError(`Укажите либо --collection, либо --query`);
    }

    let foundCount = 0;
    let page = 1;

    try {
      // Регулярное выражение для парсинга изображений из HTML
      const imgRegex = /https:\/\/shot\.cafe\/images\/t\/([a-z0-9\-]+)-(\d+)\.jpg/gi;

      while (foundCount < limit) {
        const pageUrl = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;

        log(`Загрузка ${pageUrl}`);

        if (!noDelay && page > 1) {
          await sleep(2000);
        }

        let html: string;
        try {
          html = await importerFetchText(pageUrl, { fetchImpl });
        } catch (e) {
          log(`Не удалось загрузить страницу ${pageUrl}: ${(e as Error).message}`);
          break;
        }

        // Парсинг всех изображений на странице
        const foundImages = new Set<string>();
        let match;
        const regexCopy = /https:\/\/shot\.cafe\/images\/t\/([a-z0-9\-]+)-(\d+)\.jpg/gi;

        while ((match = regexCopy.exec(html)) !== null) {
          const fullUrl = match[0];
          const slug = match[1];
          const id = match[2];

          if (foundImages.has(fullUrl)) {
            continue;
          }

          if (foundCount >= limit) break;

          foundImages.add(fullUrl);

          const candidate: RefCandidate = {
            url: fullUrl,
            pageUrl: `https://shot.cafe/image/${id}`,
            license: "film still, editorial/reference use only",
            source: "shotcafe",
            sourceRef: id,
            tags: [identifier],
            meta: {
              slug,
            },
          };

          yield candidate;
          foundCount++;
        }

        // Если не найдено ни одного изображения на странице, выход
        if (foundImages.size === 0) {
          break;
        }

        page++;
      }
    } catch (e) {
      if (e instanceof UsageError) throw e;
      throw new ProviderError(`Ошибка Shot.cafe: ${(e as Error).message}`);
    }
  },
};
