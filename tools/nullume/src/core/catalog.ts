import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ModelInfo } from "./providers/types.js";
import { mergeRegistries } from "./providers/kie/registry.js";
import { SEED_MODELS } from "./providers/kie/models.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(dir, "../..", "data");

export interface CatalogData {
  built_at?: string;
  source?: string;
  models: ModelInfo[];
}

export interface PricingData {
  verified_at?: string;
  usd_per_credit?: number;
  records: any[];
}

export async function loadCatalog(): Promise<ModelInfo[]> {
  try {
    const modelsPath = path.join(dataDir, "models.json");
    if (fs.existsSync(modelsPath)) {
      const data: CatalogData = JSON.parse(fs.readFileSync(modelsPath, "utf-8"));
      return data.models || [];
    }
  } catch (e) {
    console.error("Failed to load catalog:", e);
  }

  // Fallback to seed
  return Object.entries(SEED_MODELS).map(([id, entry]) => {
    const imageList: boolean = entry.imageList ?? false;
    return {
      id,
      category: entry.category,
      api: entry.api,
      docUrl: entry.docUrl,
      fields: {},
      meta: {
        promptField: entry.promptField,
        imageField: entry.imageField,
        imageList,
        required: entry.required,
        defaults: entry.defaults,
      },
      description: entry.description,
      schemaSource: "seed" as const,
      stale: !entry.dedicated,
      source: "seed" as const,
    };
  });
}

const SEARCH_SYNONYMS: Record<string, string[]> = {
  image: ["img", "picture", "photo", "генерация", "картинка"],
  video: ["vid", "movie", "фильм", "видео"],
  audio: ["sound", "music", "song", "звук", "музыка"],
  text: ["prompt", "description", "описание"],
};

function squashText(text: string): string {
  // Support Cyrillic: [\p{L}\p{N}]+ matches Unicode letters and numbers
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

function expandSearchTerms(query: string): string[] {
  const terms = [squashText(query)];

  for (const [category, synonyms] of Object.entries(SEARCH_SYNONYMS)) {
    for (const syn of synonyms) {
      if (squashText(query).includes(syn)) {
        terms.push(category);
        break;
      }
    }
  }

  return [...new Set(terms)];
}

export function searchModels(models: ModelInfo[], query: string): ModelInfo[] {
  if (!query) return models;

  const terms = expandSearchTerms(query);
  const exact = models.filter((m) =>
    terms.some((t) => squashText(m.id).includes(t) || squashText(m.description || "").includes(t))
  );

  if (exact.length > 0) return exact;

  return models.filter((m) =>
    terms.some((t) => squashText(m.category).includes(t))
  );
}

export async function getModel(id: string): Promise<ModelInfo> {
  const models = await loadCatalog();
  const m = models.find((x) => x.id === id);
  if (!m) throw new Error(`Model not found: ${id}`);
  return m;
}
