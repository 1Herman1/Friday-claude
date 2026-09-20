import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ModelInfo } from "./providers/types.js";

export interface Preset {
  id: string;
  title: string;
  category: string;
  task: string;
  model: string;
  fallbackModels: string[];
  input: Record<string, unknown>;
  promptHint: string;
  notes: string;
}

export interface ResolvedPreset extends Preset {
  resolvedModel: string;
  substituted: boolean;
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(dir, "../..", "data");

export async function loadPresets(): Promise<Preset[]> {
  try {
    const presetsPath = path.join(dataDir, "presets.json");
    if (fs.existsSync(presetsPath)) {
      const data = JSON.parse(fs.readFileSync(presetsPath, "utf-8"));
      return data.presets || [];
    }
  } catch (e) {
    console.error("Failed to load presets:", e);
  }
  return [];
}

export async function getPreset(id: string): Promise<Preset | null> {
  const presets = await loadPresets();
  return presets.find((p) => p.id === id) || null;
}

export async function resolvePreset(
  presetId: string,
  catalog: ModelInfo[]
): Promise<ResolvedPreset | null> {
  const preset = await getPreset(presetId);
  if (!preset) return null;

  const catalogIds = new Set(catalog.map((m) => m.id));

  // Try main model first
  let resolvedModel = preset.model;
  let substituted = false;

  if (!catalogIds.has(preset.model)) {
    // Try fallbacks
    for (const fallback of preset.fallbackModels) {
      if (catalogIds.has(fallback)) {
        resolvedModel = fallback;
        substituted = true;
        break;
      }
    }

    // If still not found, use first from catalog that matches category
    if (!substituted && resolvedModel === preset.model) {
      const matching = catalog.find(
        (m) => m.category === (preset.category as any)
      );
      if (matching) {
        resolvedModel = matching.id;
        substituted = true;
      }
    }
  }

  return {
    ...preset,
    resolvedModel,
    substituted,
  };
}
