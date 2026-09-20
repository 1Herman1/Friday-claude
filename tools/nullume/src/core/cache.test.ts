import { test } from "node:test";
import assert from "node:assert";
import { getCacheKey, getCachedSchema, setCachedSchema } from "./cache.js";

test("getCacheKey generates consistent hashes", () => {
  const url = "https://docs.kie.ai/market/test.md";
  const key1 = getCacheKey(url);
  const key2 = getCacheKey(url);
  assert.strictEqual(key1, key2, "Same URL should produce same cache key");
});

test("getCacheKey generates different hashes for different URLs", () => {
  const url1 = "https://docs.kie.ai/market/model1.md";
  const url2 = "https://docs.kie.ai/market/model2.md";
  const key1 = getCacheKey(url1);
  const key2 = getCacheKey(url2);
  assert.notStrictEqual(key1, key2, "Different URLs should produce different cache keys");
});

test("getCacheKey includes schema- prefix", () => {
  const url = "https://docs.kie.ai/market/test.md";
  const key = getCacheKey(url);
  assert(key.startsWith("schema-"), "Cache key should start with 'schema-'");
});

test("cache key hash has consistent format", () => {
  const url = "https://docs.kie.ai/market/test.md";
  const key = getCacheKey(url);
  const hashPart = key.slice(7); // Remove "schema-" prefix
  assert.strictEqual(hashPart.length, 40, "SHA1 hash should be 40 characters");
  assert(/^[a-f0-9]+$/.test(hashPart), "Hash should be lowercase hex");
});
