import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { arenaImporter } from "./arena.js";
import { mockConfig, createMockFetch } from "../testing-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "../__fixtures__");

test("arena: should require --collection or --query", async () => {
  const opts = {
    log: () => {},
    limit: 10,
    fetchImpl: fetch,
    config: mockConfig(),
    env: {},
  };

  // @ts-ignore
  let error: Error | null = null;
  try {
    for await (const _ of arenaImporter.run(opts)) {
      // Should fail before yielding
    }
  } catch (e) {
    error = e as Error;
  }

  assert(error !== null, "Should throw when no collection or query");
  assert(error!.message.includes("collection") || error!.message.includes("query"));
});

test("arena: should fetch channel contents and filter Image blocks only", async () => {
  const channelResponse = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, "arena-channel-response.json"), "utf-8")
  );

  const mockFetch = createMockFetch({
    "https://api.are.na/v2/channels/architecture/contents?page=1&per=50": {
      status: 200,
      data: channelResponse,
    },
  });

  const candidates: any[] = [];

  const opts = {
    log: () => {},
    limit: 10,
    collection: "architecture",
    fetchImpl: mockFetch,
    config: mockConfig(),
    env: {},
  };

  // @ts-ignore
  for await (const candidate of arenaImporter.run(opts)) {
    candidates.push(candidate);
  }

  // Should get 2 Image blocks (Text block is filtered out)
  assert.strictEqual(candidates.length, 2);
  assert.strictEqual(candidates[0].source, "arena");
  assert.strictEqual(candidates[0].author, "John Doe");
  assert(candidates[0].url.startsWith("https://"));
});

test("arena: should support search by query", async () => {
  const searchResponse = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, "arena-search-response.json"), "utf-8")
  );

  const mockFetch = createMockFetch({
    "https://api.are.na/v2/search/blocks?q=typography&page=1&per=50": {
      status: 200,
      data: searchResponse,
    },
  });

  const candidates: any[] = [];

  const opts = {
    log: () => {},
    limit: 10,
    query: "typography",
    fetchImpl: mockFetch,
    config: mockConfig(),
    env: {},
  };

  // @ts-ignore
  for await (const candidate of arenaImporter.run(opts)) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 1);
  assert(candidates[0].url.includes("search1.jpeg"));
});

test("arena: should respect limit parameter", async () => {
  const channelResponse = {
    contents: [
      {
        id: 1,
        class: "Image",
        image: { large: { url: "https://example.com/1.jpg" } },
      },
      {
        id: 2,
        class: "Image",
        image: { large: { url: "https://example.com/2.jpg" } },
      },
      {
        id: 3,
        class: "Image",
        image: { large: { url: "https://example.com/3.jpg" } },
      },
    ],
    total_count: 3,
  };

  const mockFetch = createMockFetch({
    "https://api.are.na/v2/channels/test/contents?page=1&per=50": {
      status: 200,
      data: channelResponse,
    },
  });

  const candidates: any[] = [];

  const opts = {
    log: () => {},
    limit: 2,
    collection: "test",
    fetchImpl: mockFetch,
    config: mockConfig(),
    env: {},
  };

  // @ts-ignore
  for await (const candidate of arenaImporter.run(opts)) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 2, "Should respect limit=2");
});

test("arena: should support Bearer token authorization", async () => {
  let authHeaderSeen = false;

  const mockFetch = async (url: string | Request, init?: RequestInit) => {
    if (init?.headers) {
      const headers = init.headers as Record<string, string>;
      if (headers.Authorization === "Bearer secret-token") {
        authHeaderSeen = true;
      }
    }
    return new Response(
      JSON.stringify({
        contents: [
          {
            id: 1,
            class: "Image",
            image: { large: { url: "https://example.com/1.jpg" } },
          },
        ],
        total_count: 1,
      }),
      { status: 200 }
    );
  };

  const opts = {
    log: () => {},
    limit: 1,
    collection: "private",
    fetchImpl: mockFetch,
    config: mockConfig({
      importers: { arena: { token: "secret-token" } },
    }),
    env: {},
  };

  // @ts-ignore
  for await (const _ of arenaImporter.run(opts)) {
    // Just iterate to trigger the fetch
  }

  assert(authHeaderSeen, "Should send Bearer token in Authorization header");
});
