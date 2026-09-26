import { extractInputSchema, deriveModelMeta } from "./schema.js";
import { SEED_MODELS, seedModelInfo, DEDICATED_DOC_URLS } from "./models.js";
import type { ModelInfo, SchemaSource } from "../types.js";

const LLMS_TXT_URL = "https://docs.kie.ai/llms.txt";

const CATEGORY_BY_BREADCRUMB: Record<string, any> = {
  "image models": "image",
  "video models": "video",
  "music models": "audio",
};

const LLMS_LINE_RE =
  /^-\s+([A-Za-z][A-Za-z ]*?Models)\b[^[]*\[([^\]]+)\]\((https:\/\/docs\.kie\.ai\/market\/[^)\s]+?\.md)\)\s*:?\s*(.*)$/;

const MODEL_JSON_RE = /"model"\s*:\s*"([^"]+)"/g;
const MODEL_YAML_RE = /^\s*model:\s*([A-Za-z0-9][\w./-]*)\s*$/gm;

function isPlausibleModelId(value: string): boolean {
  return (
    value.length >= 4 &&
    /[a-zA-Z]/.test(value) &&
    /^[\w./-]+$/.test(value) &&
    !value.startsWith("http") &&
    !value.includes("/api/")
  );
}

export interface MarketPage {
  url: string;
  category: string;
  title: string;
  description: string;
}

export function parseLlmsTxt(text: string): MarketPage[] {
  const pages: MarketPage[] = [];
  const seen = new Set<string>();

  for (const line of text.split("\n")) {
    const match = LLMS_LINE_RE.exec(line.trim());
    if (!match) continue;

    const [, breadcrumb, title, url, description] = match;
    if (url.includes("/cn/")) continue;

    const category = CATEGORY_BY_BREADCRUMB[breadcrumb.replace(/\s+/g, " ").toLowerCase()];
    if (!category || seen.has(url)) continue;

    seen.add(url);
    const desc = description.trim();
    pages.push({
      url,
      category,
      title,
      description: desc.startsWith("#") ? "" : desc,
    });
  }

  return pages;
}

export function extractModelIds(markdown: string): string[] {
  const counts = new Map<string, number>();
  const order: string[] = [];

  const add = (value: string) => {
    if (!isPlausibleModelId(value)) return;
    if (!counts.has(value)) {
      counts.set(value, 0);
      order.push(value);
    }
    counts.set(value, counts.get(value)! + 1);
  };

  for (const match of markdown.matchAll(MODEL_JSON_RE)) add(match[1]);
  for (const match of markdown.matchAll(MODEL_YAML_RE)) add(match[1]);

  return order.sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
}

export interface LiveCatalogEntry {
  id: string;
  category: string;
  description: string;
  docUrl: string;
}

export interface LiveCatalogResult {
  entries: LiveCatalogEntry[];
  unread: string[];
}

export function mergeRegistries(
  liveEntries: LiveCatalogEntry[],
  seed: Record<string, any> = SEED_MODELS
): Map<string, ModelInfo> {
  const merged = new Map<string, ModelInfo>();

  // Live entries
  for (const entry of liveEntries) {
    merged.set(entry.id, {
      id: entry.id,
      category: entry.category as any,
      api: "jobs",
      docUrl: entry.docUrl,
      fields: {},
      meta: {
        promptField: "prompt",
        imageField: undefined as any,
        imageList: false,
        required: [],
        defaults: {},
      },
      schemaSource: "docs",
      stale: false,
      source: "live",
    });
  }

  // Merge seed
  for (const [id, seedEntry] of Object.entries(seed)) {
    if (merged.has(id)) {
      const live = merged.get(id)!;
      const seedInfo = seedModelInfo(id, seedEntry);
      merged.set(id, {
        ...seedInfo,
        stale: false,
        docUrl: live.docUrl || seedInfo.docUrl,
      });
    } else {
      const seedInfo = seedModelInfo(id, seedEntry);
      merged.set(id, {
        ...seedInfo,
        stale: !seedEntry.dedicated,
      });
    }
  }

  return merged;
}

/** Одна попытка повтора: 429 на середине обхода — обычное дело */
async function fetchPage(url: string): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const resp = await fetch(url);
    if (resp.ok) return resp.text();
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    throw new Error(`HTTP ${resp.status}`);
  }
  throw new Error("unreachable");
}

/**
 * Каталог собирается обходом страниц документации. Непрочитанные страницы
 * накапливаются в unread без броска. Ошибка при недоступном llms.txt
 * остаётся — там читать нечего.
 */
export async function fetchLiveCatalogDetailed(): Promise<LiveCatalogResult> {
  const llmsResp = await fetch(LLMS_TXT_URL);
  if (!llmsResp.ok) {
    throw new Error(`Не удалось прочитать ${LLMS_TXT_URL}: HTTP ${llmsResp.status}`);
  }
  const pages = parseLlmsTxt(await llmsResp.text());

  const entries: LiveCatalogEntry[] = [];
  const unread: string[] = [];

  for (const page of pages) {
    try {
      // Страница может ответить 200 и отдать заглушку без модели — это тоже
      // неудача, просто тихая. Поэтому повторяем и по пустому разбору.
      let ids: string[] = [];
      for (let attempt = 0; attempt < 3 && ids.length === 0; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
        ids = extractModelIds(await fetchPage(page.url));
      }

      if (ids.length === 0) {
        unread.push(page.url);
        continue;
      }

      entries.push({
        id: ids[0],
        category: page.category,
        description: page.description,
        docUrl: page.url,
      });
    } catch (e) {
      unread.push(page.url);
    }
  }

  return { entries, unread };
}

/**
 * Обёртка для совместимости: возвращает только entries.
 */
export async function fetchLiveCatalog(): Promise<LiveCatalogEntry[]> {
  const result = await fetchLiveCatalogDetailed();
  return result.entries;
}
