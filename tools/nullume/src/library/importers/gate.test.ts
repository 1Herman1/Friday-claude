import { test } from "node:test";
import assert from "node:assert";
import { assertLocalOnlyAllowed, LOCAL_ONLY_WARNING } from "./gate.js";
import { UsageError } from "../../core/errors.js";
import { NullumeConfig } from "../../core/config.js";

test("assertLocalOnlyAllowed: должен выбросить ошибку если нет acknowledgedRiskyImporters", () => {
  const config: NullumeConfig = { acknowledgedRiskyImporters: false };
  const env: NodeJS.ProcessEnv = { NULLUME_LOCAL_IMPORTERS: "1" };

  assert.throws(
    () => assertLocalOnlyAllowed(config, env),
    (err) => err instanceof UsageError
  );
});

test("assertLocalOnlyAllowed: должен выбросить ошибку если нет NULLUME_LOCAL_IMPORTERS=1", () => {
  const config: NullumeConfig = { acknowledgedRiskyImporters: true };
  const env: NodeJS.ProcessEnv = { NULLUME_LOCAL_IMPORTERS: "0" };

  assert.throws(
    () => assertLocalOnlyAllowed(config, env),
    (err) => err instanceof UsageError
  );
});

test("assertLocalOnlyAllowed: должен выбросить ошибку если CI=true", () => {
  const config: NullumeConfig = { acknowledgedRiskyImporters: true };
  const env: NodeJS.ProcessEnv = { NULLUME_LOCAL_IMPORTERS: "1", CI: "true" };

  assert.throws(
    () => assertLocalOnlyAllowed(config, env),
    (err) => err instanceof UsageError
  );
});

test("assertLocalOnlyAllowed: должен выбросить ошибку если GITHUB_ACTIONS=true", () => {
  const config: NullumeConfig = { acknowledgedRiskyImporters: true };
  const env: NodeJS.ProcessEnv = { NULLUME_LOCAL_IMPORTERS: "1", GITHUB_ACTIONS: "true" };

  assert.throws(
    () => assertLocalOnlyAllowed(config, env),
    (err) => err instanceof UsageError
  );
});

test("assertLocalOnlyAllowed: должен пройти если все условия выполнены", () => {
  const config: NullumeConfig = { acknowledgedRiskyImporters: true };
  const env: NodeJS.ProcessEnv = { NULLUME_LOCAL_IMPORTERS: "1" };

  assert.doesNotThrow(() => assertLocalOnlyAllowed(config, env));
});

test("assertLocalOnlyAllowed: должен показать предупреждение при наличии прокси", () => {
  const config: NullumeConfig = { acknowledgedRiskyImporters: true };
  const env: NodeJS.ProcessEnv = { NULLUME_LOCAL_IMPORTERS: "1", HTTPS_PROXY: "http://proxy:8080" };

  // Не выбросит ошибку, но выведет console.error
  assert.doesNotThrow(() => assertLocalOnlyAllowed(config, env));
});

test("LOCAL_ONLY_WARNING должен быть непустой строкой", () => {
  assert.strictEqual(typeof LOCAL_ONLY_WARNING, "string");
  assert(LOCAL_ONLY_WARNING.length > 0);
  assert(LOCAL_ONLY_WARNING.includes("Pinterest"));
  assert(LOCAL_ONLY_WARNING.includes("Dribbble"));
  assert(LOCAL_ONLY_WARNING.includes("риск"));
});
