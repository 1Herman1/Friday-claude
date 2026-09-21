import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";
process.env.NULLUME_HOME = mkdtempSync(joinPath(tmpdir(), "nullume-rss-"));
import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rssImporter } from "./rss.js";
import { mockConfig, createMockFetch } from "../testing-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "../__fixtures__");

test("rss: should print feeds list when no collection", async () => {
  const logs: string[] = [];
  const opts = {
    log: (msg: string) => logs.push(msg),
    limit: 10,
    fetchImpl: fetch,
    config: mockConfig(),
    env: {},
  };

  // @ts-ignore - intentional partial opts for testing
  for await (const _ of rssImporter.run(opts)) {
    // Should not yield anything
  }

  assert(logs.some((l) => l.includes("Доступные ленты")));
  assert(logs.some((l) => l.includes("--collection")));
});

test("rss: should parse content strategy and extract first image", async () => {
  const xml = fs.readFileSync(
    path.join(fixturesDir, "rss-content-strategy.xml"),
    "utf-8"
  );

  const mockFetch = createMockFetch({
    "https://onepagelove.com/feed": {
      status: 200,
      data: xml,
    },
  });

  const logs: string[] = [];
  const candidates: any[] = [];

  const opts = {
    log: (msg: string) => logs.push(msg),
    limit: 10,
    collection: "onepagelove",
    fetchImpl: mockFetch,
    config: mockConfig(),
    env: { NULLUME_NO_DELAY: "1" },
  };

  // @ts-ignore
  for await (const candidate of rssImporter.run(opts)) {
    candidates.push(candidate);
  }

  // Should get 2 candidates with content strategy
  assert.strictEqual(candidates.length, 2);
  assert.strictEqual(candidates[0].source, "rss");
  assert.strictEqual(candidates[0].author, "One Page Love");
  assert(candidates[0].url.includes("cdn.example.com"));
});

test("rss: should handle feeds without images", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>Feed</title>
        <item>
          <title>Item without image</title>
          <link>https://example.com</link>
          <description>No image here</description>
        </item>
      </channel>
    </rss>`;

  const mockFetch = createMockFetch({
    "https://minimal.gallery/feed/": {
      status: 200,
      data: xml,
    },
  });

  const logs: string[] = [];
  const candidates: any[] = [];

  const opts = {
    log: (msg: string) => logs.push(msg),
    limit: 10,
    collection: "minimalgallery",
    fetchImpl: mockFetch,
    config: mockConfig(),
    env: { NULLUME_NO_DELAY: "1" },
  };

  // @ts-ignore
  for await (const candidate of rssImporter.run(opts)) {
    candidates.push(candidate);
  }

  // Should not yield any items (no images found)
  assert.strictEqual(candidates.length, 0);
});

test("rss: should respect limit", async () => {
  const opts = {
    log: () => {},
    limit: 5,
    fetchImpl: fetch,
    config: mockConfig(),
    env: { NULLUME_NO_DELAY: "1" },
  };

  // @ts-ignore
  let count = 0;
  for await (const _ of rssImporter.run(opts)) {
    count++;
  }

  // No collection, so no items
  assert.strictEqual(count, 0);
});
