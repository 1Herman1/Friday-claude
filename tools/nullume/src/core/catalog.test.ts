import { test } from "node:test";
import assert from "node:assert";
import { searchModels } from "./catalog.js";

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
