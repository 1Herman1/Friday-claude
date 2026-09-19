import type { ModelCategory, ModelInfo, SchemaSource } from "../types.js";

export const DEDICATED_DOC_URLS: Record<string, string> = {
  veo: "https://docs.kie.ai/veo3-api/generate-veo-3-video.md",
  suno: "https://docs.kie.ai/suno-api/generate-music.md",
  flux: "https://docs.kie.ai/flux-kontext-api/generate-or-edit-image.md",
  gpt4o: "https://docs.kie.ai/4o-image-api/generate-4-o-image.md",
  runway: "https://docs.kie.ai/runway-api/generate-ai-video.md",
};

interface SeedModelEntry {
  category: ModelCategory;
  api: "jobs" | "veo" | "runway" | "gpt4o" | "flux" | "suno";
  promptField?: string;
  imageField?: string;
  imageList?: boolean;
  required: string[];
  defaults: Record<string, unknown>;
  description?: string;
  dedicated?: boolean;
  docUrl?: string;
}

function m(
  category: ModelCategory,
  api: SeedModelEntry["api"],
  opts: Partial<SeedModelEntry> = {}
): SeedModelEntry {
  const entry: SeedModelEntry = {
    category,
    api,
    promptField: "prompt",
    imageField: undefined,
    imageList: false,
    required: [],
    defaults: {},
    ...opts,
  };

  if (api !== "jobs") {
    entry.dedicated = true;
    entry.docUrl = DEDICATED_DOC_URLS[api];
  }

  return entry;
}

export const SEED_MODELS: Record<string, SeedModelEntry> = {
  "google/nano-banana": m("image", "jobs", {
    required: ["prompt"],
    description: "Nano Banana (Gemini 2.5 Flash Image) — быстрая и дешёвая text-to-image от Google.",
  }),
  "google/nano-banana-2": m("image", "jobs", {
    required: ["prompt"],
    description: "Nano Banana 2 — улучшенная версия.",
  }),
  "google/imagen4": m("image", "jobs", {
    required: ["prompt"],
    description: "Google Imagen 4 — качественная text-to-image.",
  }),
  "bytedance/seedream-v4-text-to-image": m("image", "jobs", {
    required: ["prompt"],
    description: "Seedream 4.0 text-to-image.",
  }),
  "bytedance/seedance-2-video": m("video", "jobs", {
    required: ["prompt"],
    description: "Seedance 2.0 — видеогенерация от ByteDance.",
  }),
  "kling/v2-5-turbo": m("video", "jobs", {
    required: ["prompt"],
    description: "Kling 2.5 Turbo — быстрая видеогенерация.",
  }),
  "hailuo/hailuo-video": m("video", "jobs", {
    required: ["prompt"],
    description: "Hailuo Video — видеогенерация от Hailuo.",
  }),
  "flux/flux-pro-image": m("image", "jobs", {
    required: ["prompt"],
    description: "Flux Pro Image — высокое качество text-to-image.",
  }),
  "flux/flux-2-pro": m("image", "jobs", {
    required: ["prompt"],
    description: "Flux 2 Pro — улучшенная версия.",
  }),
  "veo3": m("video", "veo", {
    required: ["prompt"],
    description: "Google Veo 3 API — видеогенерация.",
  }),
  "gpt4o-image": m("image", "gpt4o", {
    required: ["prompt", "aspect_ratio", "quality"],
    defaults: { aspect_ratio: "1:1", quality: "medium" },
    description: "GPT-4o Image — text-to-image от OpenAI.",
  }),
  "suno-v4": m("audio", "suno", {
    required: ["prompt"],
    description: "Suno V4 API — музыкальная генерация.",
  }),
  "elevenlabs-tts": m("audio", "jobs", {
    required: ["prompt"],
    description: "ElevenLabs TTS — синтез речи.",
  }),
  "topaz-gigapixel": m("image", "jobs", {
    required: ["image"],
    imageField: "image",
    description: "Topaz Gigapixel AI — увеличение разрешения.",
  }),
};

export function seedModelInfo(id: string, entry: SeedModelEntry): ModelInfo {
  return {
    id,
    category: entry.category,
    api: entry.api,
    docUrl: entry.docUrl,
    fields: {},
    meta: {
      promptField: entry.promptField,
      imageField: entry.imageField,
      imageList: entry.imageList,
      required: entry.required,
      defaults: entry.defaults,
    },
    description: entry.description,
    schemaSource: "seed",
    stale: !entry.dedicated,
    source: "seed",
  };
}
