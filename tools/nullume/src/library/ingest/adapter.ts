/**
 * Typed adapter from LibraryStore to IngestStore interface
 * Bridges sync LibraryStore methods to async IngestStore expectations
 */

import type { LibraryStore, PaletteEntry } from "../store/types.js";
import type { IngestStore } from "./deps.js";

export function createIngestStore(
  store: LibraryStore,
  opts: {
    embedModel: string;
    tagOrigin?: "source" | "owner";
  }
): IngestStore {
  const tagOrigin = opts.tagOrigin || "source";

  const adapter: IngestStore = {
    // Deduplication lookups
    async findBySha(sha256: string) {
      const ref = store.findBySha256(sha256);
      return ref ? { id: ref.id } : null;
    },

    async findBySourceRef(source: string, sourceRef: string) {
      const ref = store.findBySourceRef(source, sourceRef);
      return ref ? { id: ref.id } : null;
    },

    async findByDhash(dhash: bigint, threshold: number) {
      const refs = store.findByDhash(dhash, threshold);
      return refs.map((r) => ({ id: r.id, dhash: r.dhash }));
    },

    // Reference insertion
    async insertReference(data: {
      sha256: string;
      dhash: bigint;
      source: string;
      sourceRef: string;
      originalPath: string;
      previewPath?: string;
      width: number;
      height: number;
      bytes?: number;
      pageUrl?: string;
      imageUrl?: string;
      author?: string;
      license?: string;
      meta?: Record<string, unknown>;
    }) {
      const ref = store.insertReference({
        sha256: data.sha256,
        dhash: data.dhash,
        source: data.source,
        sourceRef: data.sourceRef,
        originalPath: data.originalPath,
        previewPath: data.previewPath,
        width: data.width,
        height: data.height,
        bytes: data.bytes ?? 0,
        meta: data.meta ?? {},
        status: "active",
        pageUrl: data.pageUrl,
        imageUrl: data.imageUrl,
        author: data.author,
        license: data.license,
        importId: undefined,
      });

      return { id: ref.id };
    },

    // Palette storage
    async putPalette(refId: string, palette: Array<[number, number, number, number]>) {
      const entries: PaletteEntry[] = palette.map(([r, g, b, ratio]) => ({
        r,
        g,
        b,
        ratio,
      }));
      store.putPalette(refId, entries);
    },

    // Tag management
    async addTags(refId: string, tags: string[]) {
      store.addTags(refId, tags, tagOrigin);
    },

    // Embedding storage
    async putEmbedding(refId: string, embedding: Float32Array) {
      store.putEmbedding(refId, opts.embedModel, embedding);
    },

    // Embedding retrieval for deduplication
    async listEmbeddings() {
      const embeddings = store.listEmbeddings(opts.embedModel);
      return embeddings.map((e) => ({
        refId: e.refId,
        embedding: e.vec,
      }));
    },

    // Transaction support (LibraryStore.transaction is sync, wrap in async)
    async transaction<T>(fn: (store: IngestStore) => Promise<T>): Promise<T> {
      // Note: LibraryStore.transaction is synchronous, but IngestStore.transaction is async
      // We execute the async function directly without attempting to wrap in sync transaction
      return fn(adapter);
    },
  };

  return adapter;
}
