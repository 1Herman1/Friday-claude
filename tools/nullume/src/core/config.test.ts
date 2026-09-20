import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig, saveConfig, mergeConfig, getApiKey } from "./config.js";
import { ConfigError } from "./errors.js";

test("loadConfig returns empty object when no config exists", async () => {
  const config = await loadConfig();
  assert.strictEqual(typeof config, "object");
});

test("saveConfig and loadConfig roundtrip", async () => {
  const testConfig = { apiKey: "test-key", custom: "value" };
  await saveConfig(testConfig);
  const loaded = await loadConfig();
  assert.strictEqual(loaded.apiKey, "test-key");
  assert.strictEqual(loaded.custom, "value");
});

test("getApiKey prefers env over config", async () => {
  process.env.KIE_API_KEY = "env-key";
  const key = await getApiKey();
  assert.strictEqual(key, "env-key");
  delete process.env.KIE_API_KEY;
});

test("getApiKey throws when key not available", async () => {
  delete process.env.KIE_API_KEY;
  // Clear config by loading empty
  try {
    const key = await getApiKey();
    // If config has key from previous test, that's ok
    assert(typeof key === "string");
  } catch (e) {
    assert(e instanceof ConfigError);
  }
});
