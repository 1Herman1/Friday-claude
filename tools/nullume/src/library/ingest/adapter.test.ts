/**
 * Unit tests for IngestStore adapter
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { createIngestStore } from "./adapter.js";
import { MemoryStore } from "../store/memory.js";

describe("createIngestStore adapter", () => {
  it("should adapt LibraryStore to IngestStore interface", async () => {
    const memStore = new MemoryStore();
    const adapter = createIngestStore(memStore, {
      embedModel: "test-model",
      tagOrigin: "source",
    });

    // Test insertReference
    const ref = await adapter.insertReference({
      sha256: "abc123",
      dhash: BigInt("0x123456"),
      source: "test",
      sourceRef: "test-ref",
      originalPath: "/tmp/original.png",
      width: 100,
      height: 100,
    });

    assert.notEqual(ref.id, undefined);
    assert.equal(typeof ref.id, "string");
  });

  it("should handle palette storage", async () => {
    const memStore = new MemoryStore();
    const adapter = createIngestStore(memStore, {
      embedModel: "test-model",
    });

    const ref = await adapter.insertReference({
      sha256: "def456",
      dhash: BigInt("0x654321"),
      source: "test",
      sourceRef: "test-ref-2",
      originalPath: "/tmp/original2.png",
      width: 200,
      height: 200,
    });

    // Store palette
    await adapter.putPalette(ref.id, [
      [255, 0, 0, 50],
      [0, 255, 0, 30],
    ]);

    // Verify palette was stored
    const palette = memStore.getPalette(ref.id);
    assert.notEqual(palette, undefined);
    assert.equal(palette?.length, 2);
    assert.deepEqual(palette?.[0], { r: 255, g: 0, b: 0, ratio: 50 });
  });

  it("should track tags with correct origin", async () => {
    const memStore = new MemoryStore();
    const adapter = createIngestStore(memStore, {
      embedModel: "test-model",
      tagOrigin: "cli",
    });

    const ref = await adapter.insertReference({
      sha256: "ghi789",
      dhash: BigInt("0xaabbcc"),
      source: "test",
      sourceRef: "test-ref-3",
      originalPath: "/tmp/original3.png",
      width: 300,
      height: 300,
    });

    await adapter.addTags(ref.id, ["tag1", "tag2"]);

    const tags = memStore.getTags(ref.id);
    assert.ok(tags.includes("tag1"));
    assert.ok(tags.includes("tag2"));
  });

  it("should find references by SHA256", async () => {
    const memStore = new MemoryStore();
    const adapter = createIngestStore(memStore, {
      embedModel: "test-model",
    });

    const sha = "sha256-123";
    const ref = await adapter.insertReference({
      sha256: sha,
      dhash: BigInt("0x111111"),
      source: "test",
      sourceRef: "test-ref-4",
      originalPath: "/tmp/original4.png",
      width: 400,
      height: 400,
    });

    const found = await adapter.findBySha(sha);
    assert.equal(found?.id, ref.id);
  });

  it("should find references by source ref", async () => {
    const memStore = new MemoryStore();
    const adapter = createIngestStore(memStore, {
      embedModel: "test-model",
    });

    const source = "unsplash";
    const sourceRef = "photo-123";
    const ref = await adapter.insertReference({
      sha256: "sha-456",
      dhash: BigInt("0x222222"),
      source,
      sourceRef,
      originalPath: "/tmp/original5.png",
      width: 500,
      height: 500,
    });

    const found = await adapter.findBySourceRef(source, sourceRef);
    assert.equal(found?.id, ref.id);
  });

  it("should find similar images by dhash", async () => {
    const memStore = new MemoryStore();
    const adapter = createIngestStore(memStore, {
      embedModel: "test-model",
    });

    const dhash = BigInt("0x333333");
    const ref = await adapter.insertReference({
      sha256: "sha-789",
      dhash,
      source: "test",
      sourceRef: "test-ref-5",
      originalPath: "/tmp/original6.png",
      width: 600,
      height: 600,
    });

    // Find with threshold
    const found = await adapter.findByDhash(dhash, 0);
    assert.equal(found.length, 1);
    assert.equal(found[0].id, ref.id);
  });

  it("should handle embeddings with correct model", async () => {
    const memStore = new MemoryStore();
    const modelId = "Xenova/clip-vit-base-patch32";
    const adapter = createIngestStore(memStore, {
      embedModel: modelId,
    });

    const ref = await adapter.insertReference({
      sha256: "sha-embedding",
      dhash: BigInt("0x444444"),
      source: "test",
      sourceRef: "test-ref-6",
      originalPath: "/tmp/original7.png",
      width: 700,
      height: 700,
    });

    // Store embedding
    const embedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    await adapter.putEmbedding(ref.id, embedding);

    // Verify embedding was stored with correct model
    const embeddings = await adapter.listEmbeddings();
    assert.equal(embeddings.length, 1);
    assert.equal(embeddings[0].refId, ref.id);
    assert.deepEqual(embeddings[0].embedding, embedding);

    // Verify it's stored under the correct model in the underlying store
    const stored = memStore.getEmbedding(ref.id, modelId);
    assert.deepEqual(stored, embedding);
  });
});
