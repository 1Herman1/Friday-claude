import { test } from "node:test";
import assert from "node:assert";
import { fetchLiveCatalogDetailed } from "./registry.js";

test("fetchLiveCatalogDetailed handles pages without models as unread", async () => {
  const savedFetch = globalThis.fetch;
  const urls: string[] = [];

  globalThis.fetch = (async (url: string) => {
    urls.push(String(url));

    if (String(url).includes("llms.txt")) {
      return {
        ok: true,
        status: 200,
        text: async () => `
- Image Models [Some Title](https://docs.kie.ai/market/model1.md): Description 1
- Video Models [Video Title](https://docs.kie.ai/market/model2.md): Description 2
        `,
      } as unknown as Response;
    }

    if (String(url).includes("model1.md")) {
      return {
        ok: true,
        status: 200,
        text: async () => "Some content without model field",
      } as unknown as Response;
    }

    if (String(url).includes("model2.md")) {
      return {
        ok: true,
        status: 200,
        text: async () => `
input:
  properties:
    prompt:
      type: string
model: video-model-123
      `,
      } as unknown as Response;
    }

    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  try {
    const result = await fetchLiveCatalogDetailed();

    assert.strictEqual(result.entries.length, 1);
    assert.strictEqual(result.entries[0].id, "video-model-123");
    assert.strictEqual(result.entries[0].category, "video");

    assert.strictEqual(result.unread.length, 1);
    assert(result.unread[0].includes("model1.md"));
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("fetchLiveCatalogDetailed handles fetch errors as unread", async () => {
  const savedFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string) => {
    if (String(url).includes("llms.txt")) {
      return {
        ok: true,
        status: 200,
        text: async () => `
- Image Models [Title 1](https://docs.kie.ai/market/good.md): Desc
- Image Models [Title 2](https://docs.kie.ai/market/bad.md): Desc
        `,
      } as unknown as Response;
    }

    if (String(url).includes("good.md")) {
      return {
        ok: true,
        status: 200,
        text: async () => `model: image-model-456`,
      } as unknown as Response;
    }

    if (String(url).includes("bad.md")) {
      return {
        ok: false,
        status: 500,
      } as unknown as Response;
    }

    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  try {
    const result = await fetchLiveCatalogDetailed();

    assert.strictEqual(result.entries.length, 1);
    assert.strictEqual(result.entries[0].id, "image-model-456");

    assert.strictEqual(result.unread.length, 1);
    assert(result.unread[0].includes("bad.md"));
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("fetchLiveCatalogDetailed throws on llms.txt unavailable", async () => {
  const savedFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string) => {
    if (String(url).includes("llms.txt")) {
      return {
        ok: false,
        status: 404,
      } as unknown as Response;
    }
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  try {
    await assert.rejects(
      async () => {
        await fetchLiveCatalogDetailed();
      },
      /Не удалось прочитать/
    );
  } finally {
    globalThis.fetch = savedFetch;
  }
});
