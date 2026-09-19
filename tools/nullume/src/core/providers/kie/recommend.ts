import type { ModelInfo, ModelCategory } from "../types.js";
import type { PricingRecord } from "./pricing.js";
import { priceForModel } from "./pricing.js";

export const POPULAR_FAMILIES: Record<string, string[]> = {
  image: ["nano-banana", "gpt-image", "flux", "seedream", "imagen"],
  video: ["seedance", "veo", "kling", "hailuo", "sora"],
  audio: ["suno", "elevenlabs"],
};

interface FamilyParsed {
  family: string;
  version: number;
  suffix: string;
}

export function familyOf(modelId: string): FamilyParsed {
  const norm = String(modelId)
    .toLowerCase()
    .replace(/[/_\s]+/g, "-")
    .replace(/v(?=\d)/g, "");

  const match = /(\d+)(?:[.-](\d+))?/.exec(norm);
  if (!match) return { family: norm, version: 0, suffix: "" };

  const family = norm.slice(0, match.index).replace(/-+$/g, "");
  const minor = match[2] ? Number(match[2]) / Math.pow(10, match[2].length) : 0;
  const suffix = norm.slice(match.index + match[0].length).replace(/^-+/g, "");

  return { family, version: Number(match[1]) + minor, suffix };
}

function popularityIndex(category: string, family: string): number {
  const keys = POPULAR_FAMILIES[category] || [];
  for (let i = 0; i < keys.length; i++) {
    if (family.includes(keys[i])) return i;
  }
  return Infinity;
}

interface DecoratedModel {
  id: string;
  model: ModelInfo;
  family: string;
  version: number;
  suffix: string;
  price: any;
  priceMax: number;
}

function pickTopModel(
  candidates: Array<[string, ModelInfo]>,
  pricingRecords: PricingRecord[]
): DecoratedModel {
  const decorated: DecoratedModel[] = candidates.map(([id, model]) => {
    const parsed = familyOf(id);
    const price = priceForModel(pricingRecords, id);
    return {
      id,
      model,
      ...parsed,
      price,
      priceMax: price ? price.creditsMax : -1,
    };
  });

  decorated.sort(
    (a, b) =>
      b.version - a.version ||
      b.priceMax - a.priceMax ||
      a.suffix.length - b.suffix.length ||
      a.id.localeCompare(b.id)
  );

  return decorated[0];
}

export interface RecommendationItem {
  model: string;
  family: string;
  description: string;
  tier?: "quality" | "balanced" | "budget";
  price?: any;
}

export function recommend(
  category: ModelCategory,
  models: ModelInfo[],
  pricingRecords: PricingRecord[],
  limit: number = 4
): RecommendationItem[] {
  const families = new Map<string, Array<[string, ModelInfo]>>();

  for (const model of models) {
    if (model.category !== category || model.stale) continue;
    const { family } = familyOf(model.id);
    if (!families.has(family)) families.set(family, []);
    families.get(family)!.push([model.id, model]);
  }

  const tops = [...families.entries()].map(([family, candidates]) => ({
    family,
    popularity: popularityIndex(category, family),
    top: pickTopModel(candidates, pricingRecords),
  }));

  tops.sort(
    (a, b) =>
      a.popularity - b.popularity ||
      b.top.version - a.top.version ||
      b.top.priceMax - a.top.priceMax ||
      a.family.localeCompare(b.family)
  );

  const seenKeys = new Set<string>();
  const deduped = tops.filter(({ family }) => {
    const key = POPULAR_FAMILIES[category]?.find((k) => family.includes(k));
    if (!key) return true;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  const prices = new Map<string, any>();
  for (const record of pricingRecords) {
    if (!record.id) continue;
    if (!prices.has(record.id)) prices.set(record.id, []);
    prices.get(record.id)!.push(record);
  }

  const result: RecommendationItem[] = [];
  for (const { top } of deduped.slice(0, limit)) {
    const price = priceForModel(pricingRecords, top.id);
    result.push({
      model: top.id,
      family: top.family,
      description: top.model.description || "",
      price,
    });
  }

  return result;
}
