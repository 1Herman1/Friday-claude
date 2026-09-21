import fs from "node:fs";
import path from "node:path";
import { Jimp } from "jimp";
import { RefCandidate } from "../../library/importers/types.js";
import { downloadFile } from "../../core/download.js";
import { assertUploadable } from "../../core/files.js";
import { getLibraryOriginalsDir, getLibraryPreviewsDir } from "../../core/paths.js";
import { IngestDeps } from "./deps.js";
import { sha256File, dhash64, hamming } from "./hash.js";
import { makePreview, IngestError } from "./preview.js";
import { extractPalette } from "./palette.js";

export type IngestStatus = "ingested" | "dedup" | "failed";

export interface IngestResult {
  status: IngestStatus;
  refId?: string;
  reason?: string;
  previewPath?: string;
}

const DHASH_THRESHOLD = 6; // Hamming distance threshold for similar images
const COSINE_SIMILARITY_THRESHOLD = 0.97;

/**
 * Main ingestion pipeline
 */
export async function ingest(candidate: RefCandidate, deps: IngestDeps): Promise<IngestResult> {
  const log = deps.log;

  try {
    // Validate candidate schema
    if (!candidate.url && !candidate.filePath) {
      return { status: "failed", reason: "No url or filePath provided" };
    }

    // Dedup by sourceRef
    const existing = await deps.store.findBySourceRef(candidate.source, candidate.sourceRef);
    if (existing) {
      log(`Dedup: source-ref ${candidate.source}:${candidate.sourceRef}`);
      return { status: "dedup", reason: "source-ref", refId: existing.id };
    }

    let filePath: string;
    let tmpPath: string | null = null;

    // Download or validate file
    if (candidate.url) {
      tmpPath = path.join(getLibraryOriginalsDir(), `.tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      try {
        filePath = await downloadFile(candidate.url, tmpPath, getLibraryOriginalsDir(), 25 * 1024 * 1024);
      } catch (e) {
        return { status: "failed", reason: `Download failed: ${(e as Error).message}` };
      }
    } else {
      try {
        filePath = await assertUploadable(candidate.filePath!, [process.cwd(), ...(deps.allowedRoots ?? [])]);
        // Copy to temp for processing
        tmpPath = path.join(getLibraryOriginalsDir(), `.tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
        await fs.promises.mkdir(path.dirname(tmpPath), { recursive: true });
        await fs.promises.copyFile(filePath, tmpPath);
        filePath = tmpPath;
      } catch (e) {
        return { status: "failed", reason: `File validation failed: ${(e as Error).message}` };
      }
    }

    // Compute SHA256
    let sha256: string;
    try {
      sha256 = await sha256File(filePath);
    } catch (e) {
      if (tmpPath) await fs.promises.unlink(tmpPath).catch(() => {});
      return { status: "failed", reason: `SHA256 computation failed: ${(e as Error).message}` };
    }

    // Dedup by SHA256
    const bySha = await deps.store.findBySha(sha256);
    if (bySha) {
      if (tmpPath) await fs.promises.unlink(tmpPath).catch(() => {});
      log(`Dedup: sha256 ${sha256}`);
      return { status: "dedup", reason: "sha256", refId: bySha.id };
    }

    // Decode image and get dimensions
    let image: any;
    try {
      image = await Jimp.read(filePath);
    } catch (e) {
      if (tmpPath) await fs.promises.unlink(tmpPath).catch(() => {});
      return { status: "failed", reason: `Image decode failed: ${(e as Error).message}` };
    }

    const width = image.width;
    const height = image.height;

    // Rename to originals directory
    const ext = path.extname(filePath).toLowerCase();
    const originalPath = path.join(getLibraryOriginalsDir(), sha256 + ext);
    try {
      await fs.promises.mkdir(getLibraryOriginalsDir(), { recursive: true });
      if (tmpPath && tmpPath !== originalPath) {
        await fs.promises.rename(tmpPath, originalPath);
      } else if (!tmpPath) {
        await fs.promises.copyFile(filePath, originalPath);
      }
    } catch (e) {
      if (tmpPath) await fs.promises.unlink(tmpPath).catch(() => {});
      return { status: "failed", reason: `Failed to save original: ${(e as Error).message}` };
    }

    // Compute dHash
    const dhash = await dhash64(image);

    // Dedup by dHash
    const byDhash = await deps.store.findByDhash(dhash, DHASH_THRESHOLD);
    if (byDhash.length > 0) {
      log(`Dedup: dhash ${dhash.toString(16)} (found ${byDhash.length} similar)`);
      return { status: "dedup", reason: "dhash", refId: byDhash[0].id };
    }

    // Create preview
    const previewPath = path.join(getLibraryPreviewsDir(), sha256 + ".jpg");
    let previewResult;
    try {
      previewResult = await makePreview(originalPath, previewPath);
    } catch (e) {
      if ((e as any)?.code === "too-large") {
        return { status: "failed", reason: "Image too large" };
      }
      return { status: "failed", reason: `Preview creation failed: ${(e as Error).message}` };
    }

    // Extract palette
    let palette: Array<[number, number, number, number]>;
    try {
      const entries = candidate.palette || (await extractPalette(image));
      palette = entries.map((e) => [...e.color, Math.round(e.ratio * 100)] as [number, number, number, number]);
    } catch (e) {
      return { status: "failed", reason: `Palette extraction failed: ${(e as Error).message}` };
    }

    // Compute embedding if available
    let embedding: Float32Array | null = null;
    if (deps.embedder) {
      try {
        embedding = await deps.embedder.embedImage(originalPath);
      } catch (e) {
        log(`Warning: embedding failed: ${(e as Error).message}`);
      }
    }

    // Dedup by cosine similarity
    if (embedding) {
      try {
        const existing = await deps.store.listEmbeddings();
        for (const { embedding: existing_emb } of existing) {
          const similarity = cosineSimilarity(embedding, existing_emb);
          if (similarity > COSINE_SIMILARITY_THRESHOLD) {
            log(`Dedup: cosine similarity ${similarity.toFixed(3)}`);
            return { status: "dedup", reason: "cosine", refId: "" };
          }
        }
      } catch (e) {
        log(`Warning: cosine dedup check failed: ${(e as Error).message}`);
      }
    }

    // Store in transaction
    let refId: string;
    try {
      const ref = await deps.store.insertReference({
        sha256,
        dhash,
        source: candidate.source,
        sourceRef: candidate.sourceRef,
        originalPath,
        previewPath,
        width,
        height,
      });
      refId = ref.id;
    } catch (e) {
      return { status: "failed", reason: `Store insertion failed: ${(e as Error).message}` };
    }

    // Store metadata
    try {
      await deps.store.transaction(async (store) => {
        await store.putPalette(refId, palette);
        if (candidate.tags && candidate.tags.length > 0) {
          await store.addTags(refId, candidate.tags);
        }
        if (embedding) {
          await store.putEmbedding(refId, embedding);
        }
      });
    } catch (e) {
      return { status: "failed", reason: `Metadata storage failed: ${(e as Error).message}` };
    }

    // Fire-and-forget Unsplash download notification
    if (candidate.meta?.downloadLocation) {
      const fetchFn = deps.fetchImpl || fetch;
      fetchFn(candidate.meta.downloadLocation as string).catch((e) => {
        log(`Warning: Unsplash notification failed: ${(e as Error).message}`);
      });
    }

    log(`Ingested: ${refId} (${width}×${height})`);
    return { status: "ingested", refId, previewPath };
  } catch (e) {
    return { status: "failed", reason: `Unexpected error: ${(e as Error).message}` };
  }
}

/**
 * Compute cosine similarity between two embeddings
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
