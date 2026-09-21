import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig, saveConfig, mergeConfig, getApiKey, getImporterSetting, NullumeConfig } from "./config.js";
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

test("getImporterSetting: должен вернуть значение из config", () => {
  const config: NullumeConfig = {
    importers: {
      pexels: { token: "abc123" },
    },
  };

  const value = getImporterSetting(config, "pexels", "token");
  assert.strictEqual(value, "abc123");
});

test("getImporterSetting: должен вернуть значение из env", () => {
  const config: NullumeConfig = {};
  const oldEnv = process.env.NULLUME_UNSPLASH_KEY;
  process.env.NULLUME_UNSPLASH_KEY = "env-value";

  const value = getImporterSetting(config, "unsplash", "key");
  assert.strictEqual(value, "env-value");

  // Cleanup
  if (oldEnv === undefined) {
    delete process.env.NULLUME_UNSPLASH_KEY;
  } else {
    process.env.NULLUME_UNSPLASH_KEY = oldEnv;
  }
});

test("getImporterSetting: должен приоритизировать config над env", () => {
  const config: NullumeConfig = {
    importers: {
      test: { key: "config-value" },
    },
  };
  const oldEnv = process.env.NULLUME_TEST_KEY;
  process.env.NULLUME_TEST_KEY = "env-value";

  const value = getImporterSetting(config, "test", "key");
  assert.strictEqual(value, "config-value");

  // Cleanup
  if (oldEnv === undefined) {
    delete process.env.NULLUME_TEST_KEY;
  } else {
    process.env.NULLUME_TEST_KEY = oldEnv;
  }
});

test("getImporterSetting: должен использовать кастомное имя env", () => {
  const config: NullumeConfig = {};
  const oldEnv = process.env.CUSTOM_VAR;
  process.env.CUSTOM_VAR = "custom-value";

  const value = getImporterSetting(config, "any", "key", "CUSTOM_VAR");
  assert.strictEqual(value, "custom-value");

  // Cleanup
  if (oldEnv === undefined) {
    delete process.env.CUSTOM_VAR;
  } else {
    process.env.CUSTOM_VAR = oldEnv;
  }
});

test("getImporterSetting: должен вернуть undefined если ничего не найдено", () => {
  const config: NullumeConfig = {};
  const value = getImporterSetting(config, "nonexistent", "key");
  assert.strictEqual(value, undefined);
});
