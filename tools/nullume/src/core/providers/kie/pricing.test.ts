import { test } from "node:test";
import assert from "node:assert";
import { normalizeRecord, priceForModel, USD_PER_CREDIT } from "./pricing.js";

test("normalizeRecord filters non-image/video/audio", () => {
  const record = normalizeRecord({
    interfaceType: "chat",
    creditPrice: 100,
  });
  assert.strictEqual(record, null);
});

test("normalizeRecord normalizes image", () => {
  const record = normalizeRecord({
    interfaceType: "image",
    creditPrice: "50",
    usdPrice: "0.25",
    anchor: "?model=test-id",
  });
  assert.strictEqual(record?.id, "test-id");
  assert.strictEqual(record?.category, "image");
  assert.strictEqual(record?.creditsMin, 50);
  assert.strictEqual(record?.usdMin, 0.25);
  assert.strictEqual(record?.approximate, false);
});

test("normalizeRecord uses default USD when missing", () => {
  const record = normalizeRecord({
    interfaceType: "video",
    creditPrice: "10",
  });
  assert.strictEqual(record?.usdMin, 10 * USD_PER_CREDIT);
  assert.strictEqual(record?.approximate, true);
});

test("priceForModel aggregates multiple records", () => {
  const records = [
    {
      id: "model-id",
      category: "image",
      creditsMin: 10,
      creditsMax: 20,
      usdMin: 0.05,
      usdMax: 0.1,
      unit: "",
      provider: "",
      description: "",
      approximate: false,
    },
    {
      id: "model-id",
      category: "image",
      creditsMin: 15,
      creditsMax: 25,
      usdMin: 0.08,
      usdMax: 0.12,
      unit: "",
      provider: "",
      description: "",
      approximate: true,
    },
  ];
  const price = priceForModel(records, "model-id");
  assert.strictEqual(price?.creditsMin, 10);
  assert.strictEqual(price?.creditsMax, 25);
  assert.strictEqual(price?.approximate, true);
});

test("priceForModel returns null when not found", () => {
  const price = priceForModel([], "missing-id");
  assert.strictEqual(price, null);
});
