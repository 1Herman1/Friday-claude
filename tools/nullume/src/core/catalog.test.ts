import { test } from "node:test";
import assert from "node:assert";
import { searchModels, loadCatalog, getModel } from "./catalog.js";

test("searchModels finds by model id", () => {
  const models: any = [
    {
      id: "google/nano-banana",
      category: "image",
      description: "Quick image generator",
    },
    {
      id: "openai/gpt-image",
      category: "image",
      description: "GPT-based image",
    },
  ];

  const results = searchModels(models, "nano");
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].id, "google/nano-banana");
});

test("searchModels finds by category synonym", () => {
  const models: any = [
    {
      id: "model-1",
      category: "image",
      description: "Image model",
    },
    {
      id: "model-2",
      category: "video",
      description: "Video model",
    },
  ];

  const results = searchModels(models, "vid");
  assert(results.some((m: any) => m.category === "video"));
});

test("searchModels returns all when query empty", () => {
  const models: any = [{ id: "m1" }, { id: "m2" }];
  const results = searchModels(models, "");
  assert.strictEqual(results.length, 2);
});

test("searchModels is case insensitive", () => {
  const models: any = [
    {
      id: "Google/Nano-Banana",
      category: "image",
      description: "",
    },
  ];

  const results = searchModels(models, "GOOGLE");
  assert.strictEqual(results.length, 1);
});

test("loadCatalog отдаёт непустой вендоренный каталог", async () => {
  const models = await loadCatalog();
  assert(models.length > 0, "каталог не должен быть пустым");
  for (const m of models) {
    assert(typeof m.id === "string" && m.id.length > 0, `модель без id: ${JSON.stringify(m)}`);
    assert(m.meta, `модель без meta: ${m.id}`);
    assert(Array.isArray(m.meta.required), `required не массив: ${m.id}`);
    assert(typeof m.api === "string" && m.api.length > 0, `модель без api: ${m.id}`);
  }
});

test("getModel находит модель из каталога и падает на неизвестной", async () => {
  const models = await loadCatalog();
  const found = await getModel(models[0].id);
  assert.strictEqual(found.id, models[0].id);
  await assert.rejects(() => getModel("нет/такой-модели"), /Model not found/);
});
