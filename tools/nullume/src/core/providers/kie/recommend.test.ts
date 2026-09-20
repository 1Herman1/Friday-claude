import { test } from "node:test";
import assert from "node:assert";
import { familyOf, recommend } from "./recommend.js";

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
    {
      id: "nano-banana-2-lite",
      category: "image",
      stale: false,
      description: "Lite version",
    },
    {
      id: "nano-banana-2",
      category: "image",
      stale: false,
      description: "Standard version",
    },
    {
      id: "flux-pro",
      category: "image",
      stale: false,
      description: "Flux Pro",
    },
  ];

  const recommendations = recommend("image", models, [], 2);
  assert(recommendations.length <= 2, `Should have at most 2 recommendations, got ${recommendations.length}`);
  assert(recommendations.length > 0, `Should have at least 1 recommendation, got ${recommendations.length}`);
  assert(recommendations.every((r: any) => r.model), "All recommendations should have model field");
});
