import { test } from "node:test";
import assert from "node:assert";
import { loadPresets, getPreset, resolvePreset } from "./presets.js";
import type { ModelInfo } from "./providers/types.js";

test("loadPresets returns array of presets", async () => {
  const presets = await loadPresets();
  assert(Array.isArray(presets), "Should return array");
  assert(presets.length > 0, "Should have presets");

  // Check structure of first preset
  const p = presets[0];
  assert(p.id, "Preset should have id");
  assert(p.title, "Preset should have title");
  assert(p.category, "Preset should have category");
  assert(p.model, "Preset should have model");
  assert(Array.isArray(p.fallbackModels), "Should have fallbackModels array");
});

test("getPreset returns specific preset by id", async () => {
  const preset = await getPreset("product-photo");
  assert(preset, "Should find product-photo preset");
  assert.strictEqual(preset.id, "product-photo");
  assert(preset.title.includes("товара") || preset.title.includes("1:1"));
});

test("getPreset returns null for non-existent preset", async () => {
  const preset = await getPreset("non-existent-xyz");
  assert.strictEqual(preset, null);
});

test("resolvePreset returns preset with resolvedModel when main model exists", async () => {
  const preset = await getPreset("product-photo");
  assert(preset);

  // Mock catalog with the main model
  const catalog: ModelInfo[] = [
    {
      id: preset.model,
      category: "image" as const,
      api: "jobs" as const,
      fields: {},
      meta: { required: [], defaults: {} },
      schemaSource: "seed" as const,
      source: "vendored" as const,
    },
  ];

  const resolved = await resolvePreset("product-photo", catalog);
  assert(resolved);
  assert.strictEqual(resolved.resolvedModel, preset.model);
  assert.strictEqual(resolved.substituted, false);
});

test("resolvePreset falls back to fallbackModels when main unavailable", async () => {
  const preset = await getPreset("product-photo");
  assert(preset);

  // Mock catalog with only a fallback model
  const fallback = preset.fallbackModels[0];
  assert(fallback, "Should have fallback model defined");

  const catalog: ModelInfo[] = [
    {
      id: fallback,
      category: "image" as const,
      api: "jobs" as const,
      fields: {},
      meta: { required: [], defaults: {} },
      schemaSource: "seed" as const,
      source: "vendored" as const,
    },
  ];

  const resolved = await resolvePreset("product-photo", catalog);
  assert(resolved);
  assert.strictEqual(resolved.resolvedModel, fallback);
  assert.strictEqual(resolved.substituted, true);
});

test("resolvePreset matches category when model and fallbacks unavailable", async () => {
  const preset = await getPreset("product-photo");
  assert(preset);

  // Mock catalog with unrelated model but same category
  const catalog: ModelInfo[] = [
    {
      id: "some-other-image-model",
      category: preset.category as any,
      api: "jobs" as const,
      fields: {},
      meta: { required: [], defaults: {} },
      schemaSource: "seed" as const,
      source: "vendored" as const,
    },
  ];

  const resolved = await resolvePreset("product-photo", catalog);
  assert(resolved);
  assert.strictEqual(resolved.resolvedModel, "some-other-image-model");
  assert.strictEqual(resolved.substituted, true);
});

test("resolvePreset returns null for non-existent preset", async () => {
  const catalog: ModelInfo[] = [];
  const resolved = await resolvePreset("non-existent", catalog);
  assert.strictEqual(resolved, null);
});

test("preset has all presets ids are valid", async () => {
  const presets = await loadPresets();
  const expectedIds = [
    "product-photo",
    "banner-16x9",
    "social-square",
    "social-story",
    "image-edit",
    "upscale",
    "short-video",
    "image-to-video",
    "voiceover",
    "music",
  ];

  const actualIds = presets.map((p) => p.id);
  for (const id of expectedIds) {
    assert(actualIds.includes(id), `Should have preset ${id}`);
  }
});

test("preset input parameters are objects", async () => {
  const presets = await loadPresets();
  for (const preset of presets) {
    assert(
      typeof preset.input === "object" && preset.input !== null,
      `Preset ${preset.id} should have input object`
    );
  }
});
