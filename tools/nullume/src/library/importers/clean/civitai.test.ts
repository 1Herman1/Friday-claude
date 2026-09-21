import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { civitaiImporter } from "./civitai.js";
import { mockConfig, createMockFetch } from "../testing-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "../__fixtures__");

test("civitai: should fetch images with default parameters", async () => {
  const response = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, "civitai-response.json"), "utf-8")
  );

  // Make second page return empty to stop pagination
  const emptyResponse = { items: [], metadata: {} };

  const mockFetch = createMockFetch({
    "https://civitai.com/api/v1/images?limit=100&sort=Most+Reactions&nsfw=false&period=Month": {
      status: 200,
      data: response,
    },
    "https://civitai.com/api/v1/images?limit=100&sort=Most+Reactions&nsfw=false&period=Month&cursor=cursor123": {
      status: 200,
      data: emptyResponse,
    },
  });

  const candidates: any[] = [];

  const opts = {
    log: () => {},
    limit: 10,
    fetchImpl: mockFetch,
    config: mockConfig(),
    env: {},
  };

  // @ts-ignore
  for await (const candidate of civitaiImporter.run(opts)) {
    candidates.push(candidate);
  }

  // Should get 2 images (Moderate NSFW is filtered out)
  assert.strictEqual(candidates.length, 2);
  assert.strictEqual(candidates[0].source, "civitai");
  assert.strictEqual(candidates[0].author, "artist123");
});

test("civitai: should filter out Moderate and X NSFW images", async () => {
  const response = {
    items: [
      {
        id: 1,
        url: "https://image.civitai.com/1.jpg",
        nsfwLevel: "None",
        username: "user1",
      },
      {
        id: 2,
        url: "https://image.civitai.com/2.jpg",
        nsfwLevel: "Moderate",
        username: "user2",
      },
      {
        id: 3,
        url: "https://image.civitai.com/3.jpg",
        nsfwLevel: "X",
        username: "user3",
      },
      {
        id: 4,
        url: "https://image.civitai.com/4.jpg",
        nsfwLevel: "Soft",
        username: "user4",
      },
    ],
    metadata: {},
  };

  const mockFetch = createMockFetch({
    "https://civitai.com/api/v1/images?limit=100&sort=Most+Reactions&nsfw=false&period=Month": {
      status: 200,
      data: response,
    },
  });

  const candidates: any[] = [];

  const opts = {
    log: () => {},
    limit: 10,
    fetchImpl: mockFetch,
    config: mockConfig(),
    env: {},
  };

  // @ts-ignore
  for await (const candidate of civitaiImporter.run(opts)) {
    candidates.push(candidate);
  }

  // Should only include nsfwLevel='None'
  assert.strictEqual(candidates.length, 1);
  assert.strictEqual(candidates[0].meta.nsfwLevel, "None");
});

test("civitai: should filter by query in prompt", async () => {
  const response = {
    items: [
      {
        id: 1,
        url: "https://image.civitai.com/1.jpg",
        nsfwLevel: "None",
        username: "user1",
        meta: { prompt: "beautiful landscape painting with mountains" },
      },
      {
        id: 2,
        url: "https://image.civitai.com/2.jpg",
        nsfwLevel: "None",
        username: "user2",
        meta: { prompt: "modern interior design kitchen" },
      },
      {
        id: 3,
        url: "https://image.civitai.com/3.jpg",
        nsfwLevel: "None",
        username: "user3",
        meta: { prompt: "mountain landscape with snow" },
      },
    ],
    metadata: {},
  };

  const emptyResponse = { items: [], metadata: {} };

  const mockFetch = createMockFetch({
    "https://civitai.com/api/v1/images?limit=100&sort=Most+Reactions&nsfw=false&period=Month": {
      status: 200,
      data: response,
    },
  });

  const candidates: any[] = [];

  const opts = {
    log: () => {},
    limit: 10,
    query: "landscape",
    fetchImpl: mockFetch,
    config: mockConfig(),
    env: {},
  };

  // @ts-ignore
  for await (const candidate of civitaiImporter.run(opts)) {
    candidates.push(candidate);
  }

  // Should filter by query (case-insensitive)
  assert.strictEqual(candidates.length, 2);
  assert(candidates.every((c) => c.meta.prompt.toLowerCase().includes("landscape")));
});

test("civitai: should support cursor-based pagination", async () => {
  const page1 = {
    items: [
      {
        id: 1,
        url: "https://image.civitai.com/1.jpg",
        nsfwLevel: "None",
        username: "user1",
      },
      {
        id: 2,
        url: "https://image.civitai.com/2.jpg",
        nsfwLevel: "None",
        username: "user2",
      },
    ],
    metadata: { nextCursor: "cursor-page2" },
  };

  const page2 = {
    items: [
      {
        id: 3,
        url: "https://image.civitai.com/3.jpg",
        nsfwLevel: "None",
        username: "user3",
      },
    ],
    metadata: {},
  };

  const mockFetch = async (url: string | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.url;
    if (urlStr.includes("cursor-page2")) {
      return new Response(JSON.stringify(page2), { status: 200 });
    }
    return new Response(JSON.stringify(page1), { status: 200 });
  };

  const candidates: any[] = [];

  const opts = {
    log: () => {},
    limit: 3,
    fetchImpl: mockFetch as typeof fetch,
    config: mockConfig(),
    env: {},
  };

  // @ts-ignore
  for await (const candidate of civitaiImporter.run(opts)) {
    candidates.push(candidate);
  }

  // Should fetch all 3 items across pages
  assert.strictEqual(candidates.length, 3);
});

test("civitai: should include metadata in candidates", async () => {
  const response = {
    items: [
      {
        id: 100,
        url: "https://image.civitai.com/100.jpg",
        nsfwLevel: "None",
        username: "artist",
        width: 1024,
        height: 768,
        meta: {
          prompt: "test prompt",
          negativePrompt: "blurry",
          Model: "sd-xl",
        },
      },
    ],
    metadata: {},
  };

  const mockFetch = createMockFetch({
    "https://civitai.com/api/v1/images?limit=100&sort=Most+Reactions&nsfw=false&period=Month": {
      status: 200,
      data: response,
    },
  });

  const candidates: any[] = [];

  const opts = {
    log: () => {},
    limit: 1,
    fetchImpl: mockFetch,
    config: mockConfig(),
    env: {},
  };

  // @ts-ignore
  for await (const candidate of civitaiImporter.run(opts)) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates[0].meta.prompt, "test prompt");
  assert.strictEqual(candidates[0].meta.negativePrompt, "blurry");
  assert.strictEqual(candidates[0].meta.model, "sd-xl");
  assert.strictEqual(candidates[0].meta.width, 1024);
  assert.strictEqual(candidates[0].meta.height, 768);
});
