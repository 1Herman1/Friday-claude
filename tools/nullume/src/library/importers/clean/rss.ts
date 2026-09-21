import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProviderError, UsageError } from "../../../core/errors.js";
import { getPackageDataDir } from "../../../core/paths.js";
import { Importer, ImportRunOptions, RefCandidate } from "../types.js";
import { importerFetchText, parseRssItems, extractImgSrcs, sleep } from "../http.js";

interface Feed {
  id: string;
  title: string;
  url: string;
  imageStrategy: "content" | "enclosure" | "og";
}

export const rssImporter: Importer = {
  id: "rss",
  kind: "clean",
  title: "RSS Feeds",
  description: "Импорт изображений из RSS/Atom лент (One Page Love, Motionographer, Typewolf и др)",

  async configure(): Promise<void> {
    // Нет конфигурации
  },

  async *run(opts: ImportRunOptions): AsyncIterable<RefCandidate> {
    const { log, limit, collection, fetchImpl, env } = opts;

    // Загрузить список лент
    const feedsPath = path.join(getPackageDataDir(), "feeds.json");
    let feeds: Feed[];

    try {
      const content = await fs.promises.readFile(feedsPath, "utf-8");
      feeds = JSON.parse(content);
    } catch (e) {
      throw new ProviderError(`Не удалось загрузить feeds.json: ${(e as Error).message}`);
    }

    // Если нет collection, вывести список лент и выход
    if (!collection) {
      log("Доступные ленты:");
      for (const feed of feeds) {
        log(`  --collection ${feed.id}  # ${feed.title}`);
      }
      return;
    }

    // Найти выбранную ленту
    const feed = feeds.find((f) => f.id === collection);
    if (!feed) {
      throw new UsageError(`Лента не найдена: ${collection}`);
    }

    let foundCount = 0;
    const noDelay = env.NULLUME_NO_DELAY === "1";

    try {
      // Загрузить RSS ленту с кэшем 1 час
      const rssText = await importerFetchText(feed.url, {
        fetchImpl,
        cacheKey: `rss-${feed.id}`,
        ttlMs: 60 * 60 * 1000, // 1 hour
      });

      const items = parseRssItems(rssText);

      for (const item of items) {
        if (foundCount >= limit) break;

        if (!item.link) {
          log(`Пропуск: нет ссылки в item`);
          continue;
        }

        let imageUrl: string | undefined;

        // Стратегия 1: enclosure (прямой URL медиа)
        if (feed.imageStrategy === "enclosure" && item.enclosureUrl) {
          imageUrl = item.enclosureUrl;
        }

        // Стратегия 2: content (первая картинка в HTML контенте)
        if (!imageUrl && feed.imageStrategy === "content" && item.description) {
          const srcs = extractImgSrcs(item.description);
          if (srcs.length > 0) {
            imageUrl = srcs[0];
          }
        }

        // Стратегия 3: og (Open Graph из страницы)
        if (!imageUrl && feed.imageStrategy === "og") {
          try {
            if (!noDelay) {
              await sleep(2000);
            }
            const pageHtml = await importerFetchText(item.link, { fetchImpl });
            const ogMatch = /<meta\s+property=["']og:image["']\s+content=["']([^"']+)/i.exec(
              pageHtml
            );
            if (ogMatch) {
              imageUrl = ogMatch[1];
            }
          } catch (e) {
            log(`Не удалось загрузить og:image с ${item.link}: ${(e as Error).message}`);
          }
        }

        if (!imageUrl) {
          log(`Пропуск: не найдена картинка для ${item.title}`);
          continue;
        }

        const candidate: RefCandidate = {
          url: imageUrl,
          pageUrl: item.link,
          author: feed.title,
          source: "rss",
          sourceRef: `${feed.id}:${item.link}`,
          tags: [feed.id],
          meta: {
            title: item.title || undefined,
            pubDate: item.pubDate || undefined,
          },
        };

        yield candidate;
        foundCount++;
      }
    } catch (e) {
      if (e instanceof UsageError) throw e;
      throw new ProviderError(`Ошибка RSS импортёра: ${(e as Error).message}`);
    }
  },
};
