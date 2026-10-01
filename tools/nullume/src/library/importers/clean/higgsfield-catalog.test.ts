import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { higgsFieldImporter, toJpegUrl } from "./higgsfield-catalog.js";
import { mockConfig } from "../testing-utils.js";
import { getPackageDataDir } from "../../../core/paths.js";

test("higgsfield: toJpegUrl transforms raw webp to cdn-cgi jpeg", () => {
  const input = "https://cdn.higgsfield.ai/viral_hub/151664fa-7f7f-43d6-80fa-4683104a3c02.webp";
  const result = toJpegUrl(input);

  assert(result.includes("/cdn-cgi/image/width=1024,format=jpeg/"));
  assert(result.includes("viral_hub/151664fa-7f7f-43d6-80fa-4683104a3c02.webp"));
  // The path keeps .webp extension but format=jpeg transform ensures jpeg delivery
  assert(result.includes("format=jpeg"), "Should request jpeg format in transform params");
});

test("higgsfield: toJpegUrl preserves path when already transformed", () => {
  const input =
    "https://cdn.higgsfield.ai/cdn-cgi/image/width=1080,quality=80,format=auto/viral_hub/test-image.webp";
  const result = toJpegUrl(input);

  assert.strictEqual(result, "https://cdn.higgsfield.ai/cdn-cgi/image/width=1024,format=jpeg/viral_hub/test-image.webp");
  // Verify exactly one cdn-cgi segment
  assert.strictEqual((result.match(/\/cdn-cgi\/image\//g) || []).length, 1);
});

test("higgsfield: toJpegUrl leaves foreign hosts unchanged", () => {
  const input = "https://example.com/image.jpg";
  const result = toJpegUrl(input);

  assert.strictEqual(result, input);
});

test("higgsfield: should load real catalog in full", async () => {
  const opts = {
    log: () => {},
    limit: 5000,
    fetchImpl: fetch,
    config: mockConfig(),
    env: {},
  };

  const candidates: any[] = [];
  for await (const c of higgsFieldImporter.run(opts)) {
    candidates.push(c);
  }

  // Число позиций берём из файла: Marketing Studio довыгружается страницами.
  const catalogPath = path.join(getPackageDataDir(), "higgsfield-catalog.json");
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8")) as { items: unknown[] };
  assert.strictEqual(candidates.length, catalog.items.length, "Should load every catalog item");
  assert(candidates.length >= 111, "Catalog must not shrink below the first 111 items");

  // Viral Hub выгружен целиком — эти два раздела зафиксированы точно.
  const sections = candidates.reduce(
    (acc, c) => {
      const section = c.meta.section;
      acc[section] = (acc[section] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  assert.strictEqual(sections.filters, 33);
  assert.strictEqual(sections.effects, 54);
  assert(sections["product-shot"] >= 12);
  assert(sections.motion >= 12);
});

test("higgsfield: should filter by collection (section)", async () => {
  const opts = {
    log: () => {},
    limit: 5000,
    collection: "filters",
    fetchImpl: fetch,
    config: mockConfig(),
    env: {},
  };

  const candidates: any[] = [];
  for await (const c of higgsFieldImporter.run(opts)) {
    candidates.push(c);
  }

  assert.strictEqual(candidates.length, 33);
  candidates.forEach((c) => {
    assert.strictEqual(c.meta.section, "filters");
  });
});

test("higgsfield: should throw on unknown collection", async () => {
  const opts = {
    log: () => {},
    limit: 10,
    collection: "unknown-section",
    fetchImpl: fetch,
    config: mockConfig(),
    env: {},
  };

  let error: Error | null = null;
  try {
    for await (const _ of higgsFieldImporter.run(opts)) {
      // Should fail before yielding
    }
  } catch (e) {
    error = e as Error;
  }

  assert(error !== null, "Should throw for unknown collection");
  assert(error.message.includes("Неизвестная коллекция"));
  assert(error.message.includes("unknown-section"));
});

test("higgsfield: should filter by query (case-insensitive substring)", async () => {
  const opts = {
    log: () => {},
    limit: 5000,
    query: "NoIr",
    collection: "filters",
    fetchImpl: fetch,
    config: mockConfig(),
    env: {},
  };

  const candidates: any[] = [];
  for await (const c of higgsFieldImporter.run(opts)) {
    candidates.push(c);
  }

  // Среди фильтров ровно один Noir; в motion есть «Noir Unboxing» — поэтому collection.
  assert.strictEqual(candidates.length, 1);
  assert.strictEqual(candidates[0].meta.name, "Noir");
});

test("higgsfield: should return empty result for non-matching query", async () => {
  const opts = {
    log: () => {},
    limit: 5000,
    query: "xyznonexistent12345",
    fetchImpl: fetch,
    config: mockConfig(),
    env: {},
  };

  const candidates: any[] = [];
  for await (const c of higgsFieldImporter.run(opts)) {
    candidates.push(c);
  }

  assert.strictEqual(candidates.length, 0);
});

test("higgsfield: should respect limit parameter", async () => {
  const opts = {
    log: () => {},
    limit: 5,
    fetchImpl: fetch,
    config: mockConfig(),
    env: {},
  };

  const candidates: any[] = [];
  for await (const c of higgsFieldImporter.run(opts)) {
    candidates.push(c);
  }

  assert.strictEqual(candidates.length, 5);
});

test("higgsfield: should have proper metadata and no downloadLocation", async () => {
  const opts = {
    log: () => {},
    limit: 1,
    fetchImpl: fetch,
    config: mockConfig(),
    env: {},
  };

  const candidates: any[] = [];
  for await (const c of higgsFieldImporter.run(opts)) {
    candidates.push(c);
  }

  const c = candidates[0];
  assert.strictEqual(c.source, "higgsfield");
  assert(c.sourceRef);
  assert.strictEqual(c.author, "Higgsfield");
  assert(c.license);
  assert(c.url.includes("cdn.higgsfield.ai"));

  // Verify meta fields exist
  assert(c.meta.name);
  assert(c.meta.description !== undefined);
  assert(c.meta.section);
  assert(c.meta.group);
  assert(c.meta.previewUrl);
  assert(c.meta.previewType);
  assert(c.meta.sourceType);

  // Most importantly: no downloadLocation in meta (would trigger GET)
  assert(!c.meta.downloadLocation, "Meta should not contain downloadLocation");
});

test("higgsfield: should produce all URLs with cdn-cgi transform (no double nesting)", async () => {
  const opts = {
    log: () => {},
    limit: 20,
    fetchImpl: fetch,
    config: mockConfig(),
    env: {},
  };

  const candidates: any[] = [];
  for await (const c of higgsFieldImporter.run(opts)) {
    candidates.push(c);
  }

  candidates.forEach((c) => {
    assert(c.url.startsWith("https://cdn.higgsfield.ai/cdn-cgi/image/width=1024,format=jpeg/"));
    const cdnCgiCount = (c.url.match(/\/cdn-cgi\/image\//g) || []).length;
    assert.strictEqual(cdnCgiCount, 1, `URL should have exactly one /cdn-cgi/image/ segment: ${c.url}`);
  });
});

test("higgsfield: should have unique sourceRefs", async () => {
  const opts = {
    log: () => {},
    limit: 5000,
    fetchImpl: fetch,
    config: mockConfig(),
    env: {},
  };

  const candidates: any[] = [];
  for await (const c of higgsFieldImporter.run(opts)) {
    candidates.push(c);
  }

  const refs = new Set(candidates.map((c) => c.sourceRef));
  assert.strictEqual(refs.size, candidates.length, "All sourceRefs should be unique");
});

test("higgsfield: should tag with hf-section and hf slug tags", async () => {
  const opts = {
    log: () => {},
    limit: 10,
    fetchImpl: fetch,
    config: mockConfig(),
    env: {},
  };

  const candidates: any[] = [];
  for await (const c of higgsFieldImporter.run(opts)) {
    candidates.push(c);
  }

  candidates.forEach((c) => {
    assert(c.tags.includes("higgsfield"));
    assert(c.tags.some((t: string) => t.startsWith("hf-section:")));
    assert(c.tags.some((t: string) => t.startsWith("hf:")));
    // Should have at least hf-section, hf, and higgsfield
    assert(c.tags.length >= 3);
  });
});

test("higgsfield: limit=0 yields nothing", async () => {
  const opts = {
    log: () => {},
    limit: 0,
    fetchImpl: fetch,
    config: mockConfig(),
    env: {},
  };

  const candidates: any[] = [];
  for await (const c of higgsFieldImporter.run(opts)) {
    candidates.push(c);
  }

  assert.strictEqual(candidates.length, 0);
});

test("higgsfield: foreign-host thumbnailUrl → item skipped", async () => {
  // Create a temporary test catalog with one foreign host item
  const testCatalog = {
    fetchedAt: "2024-01-01",
    origin: "test",
    license: "test",
    items: [
      {
        id: "valid-1",
        name: "Valid Item",
        description: "Valid CDN item",
        section: "filters",
        group: "test",
        sourceType: "test",
        thumbnailUrl: "https://cdn.higgsfield.ai/test/valid.webp",
        previewUrl: "https://cdn.higgsfield.ai/test/valid-preview.jpg",
        previewType: "image",
      },
      {
        id: "foreign-1",
        name: "Foreign Host Item",
        description: "Item with foreign host",
        section: "filters",
        group: "test",
        sourceType: "test",
        thumbnailUrl: "https://example.com/foreign.jpg",
        previewUrl: "https://cdn.higgsfield.ai/test/preview.jpg",
        previewType: "image",
      },
    ],
  };

  // Write to temp file
  const tmpFile = `/tmp/test-catalog-${Date.now()}.json`;
  fs.writeFileSync(tmpFile, JSON.stringify(testCatalog));

  try {
    const logs: string[] = [];
    const opts = {
      log: (msg: string) => logs.push(msg),
      limit: 10,
      fetchImpl: fetch,
      config: mockConfig(),
      env: { NULLUME_HIGGSFIELD_CATALOG: tmpFile },
    };

    const candidates: any[] = [];
    for await (const c of higgsFieldImporter.run(opts)) {
      candidates.push(c);
    }

    // Only valid item should be yielded
    assert.strictEqual(
      candidates.length,
      1,
      `Should yield only 1 candidate (foreign host skipped). Got ${candidates.length}`
    );
    assert.strictEqual(candidates[0].meta.name, "Valid Item");

    // Verify skip was logged
    const skipLog = logs.find((l) => l.includes("Пропуск") && l.includes("Foreign Host Item"));
    assert.ok(skipLog, `Should have logged skip for foreign host. Logs: ${JSON.stringify(logs)}`);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test("higgsfield: foreign-host previewUrl → item skipped", async () => {
  // Create a temporary test catalog with one item having foreign preview
  const testCatalog = {
    fetchedAt: "2024-01-01",
    origin: "test",
    license: "test",
    items: [
      {
        id: "valid-2",
        name: "Valid Item 2",
        description: "Valid CDN item",
        section: "filters",
        group: "test",
        sourceType: "test",
        thumbnailUrl: "https://cdn.higgsfield.ai/test/valid.webp",
        previewUrl: "https://cdn.higgsfield.ai/test/valid-preview.jpg",
        previewType: "image",
      },
      {
        id: "foreign-preview",
        name: "Item with Foreign Preview",
        description: "Item with foreign preview host",
        section: "filters",
        group: "test",
        sourceType: "test",
        thumbnailUrl: "https://cdn.higgsfield.ai/test/valid.webp",
        previewUrl: "https://example.com/preview.jpg",
        previewType: "image",
      },
    ],
  };

  // Write to temp file
  const tmpFile = `/tmp/test-catalog-${Date.now()}.json`;
  fs.writeFileSync(tmpFile, JSON.stringify(testCatalog));

  try {
    const logs: string[] = [];
    const opts = {
      log: (msg: string) => logs.push(msg),
      limit: 10,
      fetchImpl: fetch,
      config: mockConfig(),
      env: { NULLUME_HIGGSFIELD_CATALOG: tmpFile },
    };

    const candidates: any[] = [];
    for await (const c of higgsFieldImporter.run(opts)) {
      candidates.push(c);
    }

    // Only valid item should be yielded
    assert.strictEqual(
      candidates.length,
      1,
      `Should yield only 1 candidate (foreign preview skipped). Got ${candidates.length}`
    );
    assert.strictEqual(candidates[0].meta.name, "Valid Item 2");

    // Verify skip was logged
    const skipLog = logs.find((l) => l.includes("Пропуск") && l.includes("Foreign Preview"));
    assert.ok(skipLog, `Should have logged skip for foreign preview. Logs: ${JSON.stringify(logs)}`);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
