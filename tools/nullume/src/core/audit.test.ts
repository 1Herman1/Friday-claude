import { test } from "node:test";
import assert from "node:assert";
import { auditCatalog } from "./audit.js";
import type { ModelInfo } from "./providers/types.js";

function createModel(overrides?: Partial<ModelInfo>): ModelInfo {
  return {
    id: "test-model",
    category: "image",
    api: "jobs",
    docUrl: "https://docs.kie.ai/test",
    fields: {},
    meta: {
      promptField: "prompt",
      imageField: "image",
      required: ["prompt"],
      defaults: {},
    },
    schemaSource: "docs",
    source: "vendored",
    ...overrides,
  };
}

test("auditCatalog detects missing models", () => {
  const vendored = [createModel({ id: "model-1" }), createModel({ id: "model-2" })];
  const live = [createModel({ id: "model-1" })];

  const report = auditCatalog(vendored, live, [], []);

  assert.strictEqual(report.summary.missing, 1);
  assert.deepStrictEqual(
    report.discrepancies.filter((d) => d.type === "model_missing").map((d) => d.modelId),
    ["model-2"]
  );
});

test("auditCatalog detects new models", () => {
  const vendored = [createModel({ id: "model-1" })];
  const live = [createModel({ id: "model-1" }), createModel({ id: "model-2" })];

  const report = auditCatalog(vendored, live, [], []);

  assert.strictEqual(report.summary.new, 1);
  assert.deepStrictEqual(
    report.discrepancies.filter((d) => d.type === "model_new").map((d) => d.modelId),
    ["model-2"]
  );
});

test("auditCatalog detects required field changes", () => {
  const vendored = [
    createModel({
      id: "model-1",
      meta: { promptField: "prompt", required: ["prompt"], defaults: {} },
    }),
  ];
  const live = [
    createModel({
      id: "model-1",
      meta: { promptField: "prompt", required: ["prompt", "style"], defaults: {} },
    }),
  ];

  const report = auditCatalog(vendored, live, [], []);

  assert.strictEqual(report.summary.metaChanged, 1);
  const disc = report.discrepancies.find((d) => d.type === "required_changed");
  assert(disc);
  assert.strictEqual(disc.vendored, "prompt");
  assert.strictEqual(disc.live, "prompt, style");
});

test("auditCatalog detects prompt field changes", () => {
  const vendored = [
    createModel({
      id: "model-1",
      meta: { promptField: "prompt", required: [], defaults: {} },
    }),
  ];
  const live = [
    createModel({
      id: "model-1",
      meta: { promptField: "text", required: [], defaults: {} },
    }),
  ];

  const report = auditCatalog(vendored, live, [], []);

  assert.strictEqual(report.summary.metaChanged, 1);
  const disc = report.discrepancies.find((d) => d.type === "prompt_field_changed");
  assert(disc);
  assert.strictEqual(disc.vendored, "prompt");
  assert.strictEqual(disc.live, "text");
});

test("auditCatalog detects image field changes", () => {
  const vendored = [
    createModel({
      id: "model-1",
      meta: { imageField: "image_url", required: [], defaults: {} },
    }),
  ];
  const live = [
    createModel({
      id: "model-1",
      meta: { imageField: "image", required: [], defaults: {} },
    }),
  ];

  const report = auditCatalog(vendored, live, [], []);

  assert.strictEqual(report.summary.metaChanged, 1);
  const disc = report.discrepancies.find((d) => d.type === "image_field_changed");
  assert(disc);
});

test("auditCatalog detects price changes", () => {
  const vendored = [
    createModel({
      id: "model-1",
      price: { creditsMin: 10, creditsMax: 20, usdMin: 0.05, usdMax: 0.1, approximate: false },
    }),
  ];
  const live = [
    createModel({
      id: "model-1",
      price: { creditsMin: 15, creditsMax: 25, usdMin: 0.075, usdMax: 0.125, approximate: false },
    }),
  ];

  const report = auditCatalog(vendored, live, [], []);

  assert.strictEqual(report.summary.priceChanged, 1);
  const disc = report.discrepancies.find((d) => d.type === "price_changed");
  assert(disc);
});

test("auditCatalog returns summary counts", () => {
  const vendored = [
    createModel({ id: "m1" }),
    createModel({ id: "m2" }),
    createModel({ id: "m3" }),
  ];
  const live = [
    createModel({ id: "m1" }),
    createModel({ id: "m4" }),
  ];

  const report = auditCatalog(vendored, live, [], []);

  assert.strictEqual(report.vendoredCount, 3);
  assert.strictEqual(report.liveCount, 2);
  assert.strictEqual(report.summary.missing, 2); // m2, m3
  assert.strictEqual(report.summary.new, 1); // m4
});

test("auditCatalog handles models with same required fields but different order", () => {
  const vendored = [
    createModel({
      id: "model-1",
      meta: { required: ["prompt", "style"], promptField: "prompt", defaults: {} },
    }),
  ];
  const live = [
    createModel({
      id: "model-1",
      meta: { required: ["style", "prompt"], promptField: "prompt", defaults: {} },
    }),
  ];

  const report = auditCatalog(vendored, live, [], []);

  // Should not detect as change since order is normalized by sort()
  assert.strictEqual(report.summary.metaChanged, 0);
});

test("auditCatalog ignores price comparison when one is missing", () => {
  const vendored = [
    createModel({
      id: "model-1",
      price: undefined,
    }),
  ];
  const live = [
    createModel({
      id: "model-1",
      price: { creditsMin: 10, creditsMax: 20, usdMin: 0.05, usdMax: 0.1, approximate: false },
    }),
  ];

  const report = auditCatalog(vendored, live, [], []);

  // Should not detect price change when only one has price
  assert.strictEqual(report.summary.priceChanged, 0);
});
