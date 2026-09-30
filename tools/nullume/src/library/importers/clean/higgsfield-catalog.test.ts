import { test } from "node:test";
import assert from "node:assert/strict";
import { higgsFieldImporter, toJpegUrl } from "./higgsfield-catalog.js";
import { mockConfig } from "../testing-utils.js";

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

test("higgsfield: should load real catalog and respect limit=500", async () => {
  const opts = {
    log: () => {},
    limit: 500,
    fetchImpl: fetch,
    config: mockConfig(),
    env: {},
  };

  const candidates: any[] = [];
  for await (const c of higgsFieldImporter.run(opts)) {
    candidates.push(c);
  }

  assert.strictEqual(candidates.length, 111, "Should load exactly 111 items");

  // Check section distribution
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
  assert.strictEqual(sections["product-shot"], 12);
  assert.strictEqual(sections.motion, 12);
});

test("higgsfield: should filter by collection (section)", async () => {
  const opts = {
    log: () => {},
    limit: 500,
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
    limit: 500,
    query: "noir",
    fetchImpl: fetch,
    config: mockConfig(),
    env: {},
  };

  const candidates: any[] = [];
  for await (const c of higgsFieldImporter.run(opts)) {
    candidates.push(c);
  }

  // Should find exactly "Noir" effect
  assert.strictEqual(candidates.length, 1);
  assert(candidates[0].meta.name.toLowerCase().includes("noir"));
});

test("higgsfield: should return empty result for non-matching query", async () => {
  const opts = {
    log: () => {},
    limit: 500,
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
    limit: 111,
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
