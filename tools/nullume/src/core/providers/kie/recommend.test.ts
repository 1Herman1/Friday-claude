import { test } from "node:test";
import assert from "node:assert";
import { familyOf, recommend } from "./recommend.js";
import type { ModelInfo } from "../types.js";

function createTestModel(overrides?: Partial<ModelInfo>): ModelInfo {
  return {
    id: "test-model",
    category: "image",
    api: "jobs",
    fields: {},
    meta: {
      promptField: "prompt",
      required: ["prompt"],
      defaults: {},
    },
    schemaSource: "docs",
    stale: false,
    source: "vendored",
    ...overrides,
  };
}

test("familyOf parses nano-banana-2", () => {
  const result = familyOf("google/nano-banana-2");
  assert.strictEqual(result.family, "google-nano-banana");
  assert.strictEqual(result.version, 2);
  assert.strictEqual(result.suffix, "");
});

test("familyOf parses seedance-2-mini", () => {
  const result = familyOf("bytedance/seedance-2-mini");
  assert.strictEqual(result.family, "bytedance-seedance");
  assert.strictEqual(result.version, 2);
  assert.strictEqual(result.suffix, "mini");
});

test("familyOf handles versioning", () => {
  const r1 = familyOf("model-v1");
  const r2 = familyOf("model-v2-5");
  assert(r2.version > r1.version);
});

test("recommend returns top models by category", () => {
  const models: any = [
    createTestModel({
      id: "nano-banana-2-lite",
      category: "image",
      description: "Lite version",
    }),
    createTestModel({
      id: "nano-banana-2",
      category: "image",
      description: "Standard version",
    }),
    createTestModel({
      id: "flux-pro",
      category: "image",
      description: "Flux Pro",
    }),
  ];

  const recommendations = recommend("image", models, [], 2);
  assert(recommendations.length <= 2, `Should have at most 2 recommendations, got ${recommendations.length}`);
  assert(recommendations.length > 0, `Should have at least 1 recommendation, got ${recommendations.length}`);
  assert(recommendations.every((r: any) => r.model), "All recommendations should have model field");
});

test("recommend filters out i2i models by default for image", () => {
  const models = [
    createTestModel({
      id: "model-t2i",
      category: "image",
      description: "Text to image",
    }),
    createTestModel({
      id: "model-i2i-edit",
      category: "image",
      description: "Image to image edit",
      meta: {
        promptField: "prompt",
        imageField: "image_url",
        required: ["prompt", "image_url"],
        defaults: {},
      },
    }),
  ];

  const recommendations = recommend("image", models, [], 10);
  assert(!recommendations.find((r) => r.model === "model-i2i-edit"), "Should exclude i2i models");
});

test("recommend filters out upscale models by default for image", () => {
  const models = [
    createTestModel({
      id: "model-t2i",
      category: "image",
      description: "Text to image",
    }),
    createTestModel({
      id: "upscale-v1",
      category: "image",
      description: "Image upscale model",
    }),
  ];

  const recommendations = recommend("image", models, [], 10);
  assert(!recommendations.find((r) => r.model === "upscale-v1"), "Should exclude upscale models");
});

test("recommend filters models with required image field for t2i", () => {
  const models = [
    createTestModel({
      id: "model-t2i",
      category: "image",
      description: "Text to image",
    }),
    createTestModel({
      id: "model-i2i",
      category: "image",
      description: "Needs input image",
      meta: {
        promptField: "prompt",
        imageField: "image",
        required: ["prompt", "image"],
        defaults: {},
      },
    }),
  ];

  const recommendations = recommend("image", models, [], 10);
  assert(!recommendations.find((r) => r.model === "model-i2i"), "Should exclude models with required image field");
});

test("recommend filters out i2v models by default for video", () => {
  const models = [
    createTestModel({
      id: "model-t2v",
      category: "video",
      description: "Text to video",
    }),
    createTestModel({
      id: "model-i2v",
      category: "video",
      description: "Image to video generation",
    }),
  ];

  const recommendations = recommend("video", models, [], 10);
  assert(!recommendations.find((r) => r.model === "model-i2v"), "Should exclude i2v models");
});

test("recommend with t2i task includes only text-to-image", () => {
  const models = [
    createTestModel({
      id: "model-t2i",
      category: "image",
      description: "Text to image",
    }),
    createTestModel({
      id: "model-i2i",
      category: "image",
      description: "Image to image edit",
    }),
    createTestModel({
      id: "upscale-v1",
      category: "image",
      description: "Image upscaler",
    }),
  ];

  const recommendations = recommend("image", models, [], 10, "t2i");
  assert.strictEqual(recommendations.length, 1, "Should include only t2i models");
  assert.strictEqual(recommendations[0].model, "model-t2i");
});

test("recommend with edit task includes only edit models", () => {
  const models = [
    createTestModel({
      id: "model-t2i",
      category: "image",
      description: "Text to image",
    }),
    createTestModel({
      id: "model-edit",
      category: "image",
      description: "Image editing",
    }),
    createTestModel({
      id: "model-i2i",
      category: "image",
      description: "Image to image",
    }),
  ];

  const recommendations = recommend("image", models, [], 10, "edit");
  assert(recommendations.find((r) => r.model === "model-edit" || r.model === "model-i2i"), "Should include edit models");
  assert(!recommendations.find((r) => r.model === "model-t2i"), "Should exclude t2i models");
});

test("recommend with upscale task includes only upscale models", () => {
  const models = [
    createTestModel({
      id: "model-t2i",
      category: "image",
      description: "Text to image",
    }),
    createTestModel({
      id: "upscale-v1",
      category: "image",
      description: "Image upscaler",
    }),
  ];

  const recommendations = recommend("image", models, [], 10, "upscale");
  assert.strictEqual(recommendations.length, 1, "Should include only upscale models");
  assert.strictEqual(recommendations[0].model, "upscale-v1");
});

test("recommend with t2v task includes only text-to-video", () => {
  const models = [
    createTestModel({
      id: "model-t2v",
      category: "video",
      description: "Text to video",
    }),
    createTestModel({
      id: "model-i2v",
      category: "video",
      description: "Image to video",
    }),
  ];

  const recommendations = recommend("video", models, [], 10, "t2v");
  assert.strictEqual(recommendations.length, 1, "Should include only t2v models");
  assert.strictEqual(recommendations[0].model, "model-t2v");
});

test("recommend with i2v task includes only image-to-video", () => {
  const models = [
    createTestModel({
      id: "model-t2v",
      category: "video",
      description: "Text to video",
    }),
    createTestModel({
      id: "model-i2v",
      category: "video",
      description: "Image to video generation",
    }),
  ];

  const recommendations = recommend("video", models, [], 10, "i2v");
  assert.strictEqual(recommendations.length, 1, "Should include only i2v models");
  assert.strictEqual(recommendations[0].model, "model-i2v");
});
