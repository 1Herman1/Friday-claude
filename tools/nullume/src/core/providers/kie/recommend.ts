import type { ModelInfo, ModelCategory } from "../types.js";
import type { PricingRecord } from "./pricing.js";
import { priceForModel } from "./pricing.js";

export type TaskType = "t2i" | "edit" | "upscale" | "t2v" | "i2v" | "tts" | "music";

export const POPULAR_FAMILIES: Record<string, string[]> = {
  image: ["nano-banana", "gpt-image", "flux", "seedream", "imagen"],
  video: ["seedance", "veo", "kling", "hailuo", "sora"],
  audio: ["suno", "elevenlabs"],
};

// Patterns to identify specific task types
const TASK_PATTERNS: Record<TaskType, RegExp> = {
  t2i: /$/i, // text-to-image is default, no pattern
  edit: /edit|image-to-image|i2i|inpaint|retouch|variation/i,
  upscale: /upscale|enhance|sr|super-resolution|super.res/i,
  t2v: /text-to-video|t2v|text.to.video/i,
  i2v: /image-to-video|i2v|image.to.video|motionctrl|motion-control|motion_control/i,
  tts: /text-to-speech|tts|text.to.speech|voiceov|voice-over|narrator/i,
  music: /music|generate.audio|generate-audio|musicgen|sound/i,
};

function getTaskTypeFromModel(modelId: string): TaskType | null {
  const lower = modelId.toLowerCase();
  for (const [task, pattern] of Object.entries(TASK_PATTERNS)) {
    if (pattern.test(lower)) {
      return task as TaskType;
    }
  }
  return null;
}

function shouldIncludeModel(model: ModelInfo, category: ModelCategory, task?: TaskType): boolean {
  if (task === "t2i" || (category === "image" && !task)) {
    // For image/text-to-image, exclude edit/upscale/etc
    const modelTask = getTaskTypeFromModel(model.id);
    const hasImageFieldRequired = model.meta.imageField && model.meta.required.includes(model.meta.imageField);
    const descriptionIndicatesTask = /edit|image-to-image|i2i|upscale|remove-background|background|inpaint|segment|layer/i.test(model.description || "") ||
      /edit|image-to-image|i2i|upscale|remove-background|background|inpaint|segment|layer/i.test(model.id);

    return !hasImageFieldRequired && !descriptionIndicatesTask && modelTask !== "edit" && modelTask !== "upscale";
  }

  if (task === "edit") {
    // For image-to-image/edit
    const modelTask = getTaskTypeFromModel(model.id);
    return modelTask === "edit" || /edit|image-to-image|i2i|inpaint|retouch|variation/i.test(model.description || "") ||
      /edit|image-to-image|i2i|inpaint|retouch|variation/i.test(model.id);
  }

  if (task === "upscale") {
    // For upscaling
    const modelTask = getTaskTypeFromModel(model.id);
    return modelTask === "upscale" || /upscale|enhance|sr|super-resolution/i.test(model.description || "") ||
      /upscale|enhance|sr|super-resolution/i.test(model.id);
  }

  if (task === "t2v" || (category === "video" && !task)) {
    // For video/text-to-video, exclude image-to-video, etc
    const modelTask = getTaskTypeFromModel(model.id);
    const descriptionIndicatesTask = /image-to-video|i2v|extend|upscale|lipsync|lip-sync|motion-control|video-to-video|v2v/i.test(model.description || "") ||
      /image-to-video|i2v|extend|upscale|lipsync|lip-sync|motion-control|video-to-video|v2v/i.test(model.id);

    return !descriptionIndicatesTask && modelTask !== "i2v";
  }

  if (task === "i2v") {
    // For image-to-video
    const modelTask = getTaskTypeFromModel(model.id);
    return modelTask === "i2v" || /image-to-video|i2v|motionctrl|motion-control/i.test(model.description || "") ||
      /image-to-video|i2v|motionctrl|motion-control/i.test(model.id);
  }

  if (task === "tts") {
    // For text-to-speech
    const modelTask = getTaskTypeFromModel(model.id);
    return modelTask === "tts" || /text-to-speech|tts|voiceover|voice-over|narrator/i.test(model.description || "") ||
      /text-to-speech|tts|voiceover|voice-over|narrator/i.test(model.id);
  }

  if (task === "music") {
    // For music generation
    const modelTask = getTaskTypeFromModel(model.id);
    return modelTask === "music" || /music|musicgen|sound.generation/i.test(model.description || "") ||
      /music|musicgen/i.test(model.id);
  }

  return false;
}

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
  limit: number = 4,
  task?: TaskType
): RecommendationItem[] {
  const families = new Map<string, Array<[string, ModelInfo]>>();

  for (const model of models) {
    if (model.category !== category || model.stale) continue;
    if (!shouldIncludeModel(model, category, task)) continue;
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
