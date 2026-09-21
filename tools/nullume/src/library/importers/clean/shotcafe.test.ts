import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { shotcafeImporter } from "./shotcafe.js";
import { mockConfig, createMockFetch } from "../testing-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "../__fixtures__");

test("shotcafe: should require --collection or --query", async () => {
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
    for await (const _ of shotcafeImporter.run(opts)) {
      // Should fail before yielding
    }
  } catch (e) {
    error = e as Error;
  }

  assert(error !== null, "Should throw when no collection or query");
});

test("shotcafe: should parse images from tag page", async () => {
  const html = fs.readFileSync(
    path.join(fixturesDir, "shotcafe-tag-page.html"),
    "utf-8"
  );

  const mockFetch = createMockFetch({
    "https://shot.cafe/tags/thriller": {
      status: 200,
      data: html,
    },
  });

  const candidates: any[] = [];

  const opts = {
    log: () => {},
    limit: 10,
    collection: "thriller",
    fetchImpl: mockFetch,
    config: mockConfig(),
    env: { NULLUME_NO_DELAY: "1" },
  };

  // @ts-ignore
  for await (const candidate of shotcafeImporter.run(opts)) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 4);
  assert.strictEqual(candidates[0].source, "shotcafe");
  assert.strictEqual(candidates[0].sourceRef, "1001");
  assert.strictEqual(candidates[0].tags[0], "thriller");
  assert(candidates[0].url.includes("noir-thriller-1001.jpg"));
});

test("shotcafe: should support color hex search", async () => {
  const html = `
    <html>
      <a href="/image/5001">
        <img src="https://shot.cafe/images/t/red-tone-5001.jpg" />
      </a>
      <a href="/image/5002">
        <img src="https://shot.cafe/images/t/crimson-5002.jpg" />
      </a>
    </html>
  `;

  const mockFetch = createMockFetch({
    "https://shot.cafe/colors/FF0000": {
      status: 200,
      data: html,
    },
  });

  const candidates: any[] = [];

  const opts = {
    log: () => {},
    limit: 10,
    query: "FF0000",
    fetchImpl: mockFetch,
    config: mockConfig(),
    env: { NULLUME_NO_DELAY: "1" },
  };

  // @ts-ignore
  for await (const candidate of shotcafeImporter.run(opts)) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 2);
  assert.strictEqual(candidates[0].tags[0], "FF0000");
  assert(candidates[0].pageUrl.includes("/image/5001"));
});

test("shotcafe: should handle hex color with # prefix", async () => {
  const html = `<a><img src="https://shot.cafe/images/t/test-6001.jpg" /></a>`;

  const mockFetch = createMockFetch({
    "https://shot.cafe/colors/00FF00": {
      status: 200,
      data: html,
    },
  });

  const candidates: any[] = [];

  const opts = {
    log: () => {},
    limit: 10,
    query: "#00FF00",
    fetchImpl: mockFetch,
    config: mockConfig(),
    env: { NULLUME_NO_DELAY: "1" },
  };

  // @ts-ignore
  for await (const candidate of shotcafeImporter.run(opts)) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 1);
  assert.strictEqual(candidates[0].tags[0], "00FF00");
});

test("shotcafe: should respect limit parameter", async () => {
  const html = `
    <html>
      <a><img src="https://shot.cafe/images/t/a-1.jpg" /></a>
      <a><img src="https://shot.cafe/images/t/b-2.jpg" /></a>
      <a><img src="https://shot.cafe/images/t/c-3.jpg" /></a>
      <a><img src="https://shot.cafe/images/t/d-4.jpg" /></a>
      <a><img src="https://shot.cafe/images/t/e-5.jpg" /></a>
    </html>
  `;

  const mockFetch = createMockFetch({
    "https://shot.cafe/tags/test": {
      status: 200,
      data: html,
    },
  });

  const candidates: any[] = [];

  const opts = {
    log: () => {},
    limit: 2,
    collection: "test",
    fetchImpl: mockFetch,
    config: mockConfig(),
    env: { NULLUME_NO_DELAY: "1" },
  };

  // @ts-ignore
  for await (const candidate of shotcafeImporter.run(opts)) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 2, "Should stop at limit");
});

test("shotcafe: should have proper metadata", async () => {
  const html = `<a><img src="https://shot.cafe/images/t/noir-style-7001.jpg" /></a>`;

  const mockFetch = createMockFetch({
    "https://shot.cafe/tags/noir": {
      status: 200,
      data: html,
    },
  });

  const candidates: any[] = [];

  const opts = {
    log: () => {},
    limit: 1,
    collection: "noir",
    fetchImpl: mockFetch,
    config: mockConfig(),
    env: { NULLUME_NO_DELAY: "1" },
  };

  // @ts-ignore
  for await (const candidate of shotcafeImporter.run(opts)) {
    candidates.push(candidate);
  }

  const c = candidates[0];
  assert.strictEqual(c.license, "film still, editorial/reference use only");
  assert.strictEqual(c.source, "shotcafe");
  assert.strictEqual(c.sourceRef, "7001");
  assert.strictEqual(c.meta.slug, "noir-style");
  assert(c.pageUrl.includes("7001"));
});

test("shotcafe: should skip duplicates on page", async () => {
  const html = `
    <html>
      <a><img src="https://shot.cafe/images/t/dupe-1.jpg" /></a>
      <a><img src="https://shot.cafe/images/t/dupe-1.jpg" /></a>
      <a><img src="https://shot.cafe/images/t/unique-2.jpg" /></a>
    </html>
  `;

  const mockFetch = createMockFetch({
    "https://shot.cafe/tags/test": {
      status: 200,
      data: html,
    },
  });

  const candidates: any[] = [];

  const opts = {
    log: () => {},
    limit: 10,
    collection: "test",
    fetchImpl: mockFetch,
    config: mockConfig(),
    env: { NULLUME_NO_DELAY: "1" },
  };

  // @ts-ignore
  for await (const candidate of shotcafeImporter.run(opts)) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 2, "Should skip exact duplicates");
});
