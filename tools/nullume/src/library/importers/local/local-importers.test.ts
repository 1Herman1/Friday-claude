import { test } from "node:test";
import assert from "node:assert/strict";
import { pinterestCookiesImporter } from "./pinterest-cookies.js";
import { xCookiesImporter } from "./x-cookies.js";
import { dribbbleImporter } from "./dribbble.js";
import { UsageError } from "../../../core/errors.js";

test("pinterest-cookies: импортёр существует и имеет вид local-only", () => {
  assert.equal(pinterestCookiesImporter.id, "pinterest-cookies");
  assert.equal(pinterestCookiesImporter.kind, "local-only");
  assert.ok(pinterestCookiesImporter.title);
  assert.ok(pinterestCookiesImporter.description);
  assert.ok(pinterestCookiesImporter.configure);
  assert.ok(pinterestCookiesImporter.run);
});

test("x-cookies: импортёр существует и имеет вид local-only", () => {
  assert.equal(xCookiesImporter.id, "x-cookies");
  assert.equal(xCookiesImporter.kind, "local-only");
  assert.ok(xCookiesImporter.title);
  assert.ok(xCookiesImporter.description);
  assert.ok(xCookiesImporter.configure);
  assert.ok(xCookiesImporter.run);
});

test("dribbble: импортёр существует и имеет вид local-only", () => {
  assert.equal(dribbbleImporter.id, "dribbble");
  assert.equal(dribbbleImporter.kind, "local-only");
  assert.ok(dribbbleImporter.title);
  assert.ok(dribbbleImporter.description);
  assert.ok(dribbbleImporter.configure);
  assert.ok(dribbbleImporter.run);
});

test("pinterest-cookies: configure без гейта выбрасывает UsageError", async () => {
  const config = { acknowledgedRiskyImporters: false };
  const env = { NULLUME_LOCAL_IMPORTERS: undefined };

  await assert.rejects(
    () => pinterestCookiesImporter.configure(config as any, env as any),
    (err: any) => err instanceof UsageError && err.message.includes("acknowledgedRiskyImporters")
  );
});

test("x-cookies: configure без NULLUME_LOCAL_IMPORTERS выбрасывает UsageError", async () => {
  const config = { acknowledgedRiskyImporters: true };
  const env = { NULLUME_LOCAL_IMPORTERS: undefined };

  await assert.rejects(
    () => xCookiesImporter.configure(config as any, env as any),
    (err: any) => err instanceof UsageError && err.message.includes("NULLUME_LOCAL_IMPORTERS")
  );
});

test("dribbble: configure в CI выбрасывает UsageError", async () => {
  const config = { acknowledgedRiskyImporters: true };
  const env = { NULLUME_LOCAL_IMPORTERS: "1", CI: "true" };

  await assert.rejects(
    () => dribbbleImporter.configure(config as any, env as any),
    (err: any) => err instanceof UsageError && err.message.includes("CI")
  );
});

test("pinterest-cookies: configure без сессии выбрасывает UsageError", async () => {
  const config = { acknowledgedRiskyImporters: true };
  const env = { NULLUME_LOCAL_IMPORTERS: "1" };

  await assert.rejects(
    () => pinterestCookiesImporter.configure(config as any, env as any),
    (err: any) => err instanceof UsageError && err.message.includes("Pinterest сессия не найдена")
  );
});

test("x-cookies: configure без сессии выбрасывает UsageError", async () => {
  const config = { acknowledgedRiskyImporters: true };
  const env = { NULLUME_LOCAL_IMPORTERS: "1" };

  await assert.rejects(
    () => xCookiesImporter.configure(config as any, env as any),
    (err: any) => err instanceof UsageError && err.message.includes("X сессия не найдена")
  );
});

test("dribbble: importers.local включает все три", async () => {
  const { localImporters } = await import("./index.js");
  const ids = localImporters.map((i) => i.id);
  assert.ok(ids.includes("pinterest-cookies"), "pinterest-cookies должен быть в localImporters");
  assert.ok(ids.includes("x-cookies"), "x-cookies должен быть в localImporters");
  assert.ok(ids.includes("dribbble"), "dribbble должен быть в localImporters");
});
