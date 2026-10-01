import fs from "node:fs";
import path from "node:path";
import { UsageError, ProviderError } from "../../../core/errors.js";
import { Importer, ImportRunOptions, RefCandidate } from "../types.js";
import { getPackageDataDir } from "../../../core/paths.js";

interface HiggsFieldItem {
  id: string;
  name: string;
  description: string;
  section: "filters" | "effects" | "product-shot" | "motion";
  group: string;
  sourceType: string;
  thumbnailUrl: string;
  previewUrl: string;
  previewType: string;
}

interface HiggsFieldCatalog {
  fetchedAt: string;
  origin: string;
  license: string;
  items: HiggsFieldItem[];
}

/**
 * Transform Higgsfield CDN webp URLs to jpeg via Cloudflare Image Transform
 */
export function toJpegUrl(url: string): string {
  if (!url.startsWith("https://cdn.higgsfield.ai/")) {
    return url;
  }

  // Extract path, handling both forms
  let path: string;
  if (url.includes("/cdn-cgi/image/")) {
    // Already has cdn-cgi/image segment: extract path part
    const match = url.match(/\/cdn-cgi\/image\/[^/]*\/(.+)$/);
    if (!match) {
      return url;
    }
    path = match[1];
  } else {
    // Raw URL: extract path after domain
    const match = url.match(/^https:\/\/cdn\.higgsfield\.ai\/(.+)$/);
    if (!match) {
      return url;
    }
    path = match[1];
  }

  // Rebuild with standard transformation
  return `https://cdn.higgsfield.ai/cdn-cgi/image/width=1024,format=jpeg/${path}`;
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const higgsFieldImporter: Importer = {
  id: "higgsfield",
  kind: "clean",
  title: "Higgsfield Catalog",
  description:
    "Каталог пресетов Higgsfield (фильтры, эффекты, product-shot, motion) — только для справки",

  async configure(): Promise<void> {
    // Нет конфигурации
  },

  async *run(opts: ImportRunOptions): AsyncIterable<RefCandidate> {
    const { log, limit, collection, query, env } = opts;

    if (limit === 0) {
      return;
    }

    // Load catalog (allow override via NULLUME_HIGGSFIELD_CATALOG env var for testing)
    let catalog: HiggsFieldCatalog;
    try {
      const catalogPathOverride = env?.NULLUME_HIGGSFIELD_CATALOG;
      let catalogPath: string;

      if (catalogPathOverride) {
        catalogPath = catalogPathOverride;
      } else {
        const dataDir = getPackageDataDir();
        catalogPath = path.join(dataDir, "higgsfield-catalog.json");
      }

      const raw = fs.readFileSync(catalogPath, "utf-8");
      catalog = JSON.parse(raw);
    } catch (e) {
      throw new ProviderError(`Не удалось загрузить каталог Higgsfield: ${(e as Error).message}`);
    }

    const validSections = ["filters", "effects", "product-shot", "motion"];
    if (collection && !validSections.includes(collection)) {
      throw new UsageError(
        `Неизвестная коллекция: ${collection}. Допустимые: ${validSections.join(", ")}`
      );
    }

    let foundCount = 0;
    const queryLower = query?.toLowerCase() ?? "";

    for (const item of catalog.items) {
      if (foundCount >= limit) {
        break;
      }

      // Filter by collection (section)
      if (collection && item.section !== collection) {
        continue;
      }

      // Filter by query (case-insensitive substring in name, description, group)
      if (queryLower) {
        const text = `${item.name} ${item.description} ${item.group}`.toLowerCase();
        if (!text.includes(queryLower)) {
          continue;
        }
      }

      // Host guard: skip items with thumbnailUrl not from cdn.higgsfield.ai
      if (!item.thumbnailUrl.startsWith("https://cdn.higgsfield.ai/")) {
        log(`Пропуск ${item.name}: адрес вне cdn.higgsfield.ai`);
        continue;
      }

      // Host guard for previewUrl if present
      if (item.previewUrl && !item.previewUrl.startsWith("https://cdn.higgsfield.ai/")) {
        log(`Пропуск ${item.name}: адрес превью вне cdn.higgsfield.ai`);
        continue;
      }

      const slug = slugifyName(item.name);

      const candidate: RefCandidate = {
        url: toJpegUrl(item.thumbnailUrl),
        source: "higgsfield",
        sourceRef: item.id,
        author: "Higgsfield",
        license: catalog.license,
        tags: ["higgsfield", `hf-section:${item.section}`, `hf-group:${item.group}`, `hf:${slug}`],
        meta: {
          name: item.name,
          description: item.description,
          section: item.section,
          group: item.group,
          previewUrl: item.previewUrl,
          previewType: item.previewType,
          sourceType: item.sourceType,
        },
      };

      yield candidate;
      foundCount++;
    }
  },
};
