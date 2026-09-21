import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { getCacheDir, ensureDir } from "./paths.js";

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Хэшировать ключ кэша
 */
function hashCacheKey(key: string): string {
  return createHash("sha1").update(key).digest("hex").slice(0, 16);
}

export async function getCached<T>(
  key: string,
  ttlMs: number = 24 * 60 * 60 * 1000 // 24h default
): Promise<T | null> {
  try {
    const cacheDir = getCacheDir();
    const hashedKey = hashCacheKey(key);
    const filePath = path.join(cacheDir, `${hashedKey}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = JSON.parse(fs.readFileSync(filePath, "utf-8")) as CacheEntry<T>;
    const age = Date.now() - content.timestamp;

    if (age > ttlMs) {
      return null;
    }

    return content.data;
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, data: T): Promise<void> {
  try {
    const cacheDir = getCacheDir();
    await ensureDir(cacheDir);

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };

    const hashedKey = hashCacheKey(key);
    const filePath = path.join(cacheDir, `${hashedKey}.json`);
    fs.writeFileSync(filePath, JSON.stringify(entry, null, 2));
  } catch (e) {
    // Silently fail on cache write
  }
}

export function getCacheKey(docUrl: string): string {
  const hash = createHash("sha1").update(docUrl).digest("hex");
  return `schema-${hash}`;
}

export async function getCachedSchema(docUrl: string): Promise<any | null> {
  const key = getCacheKey(docUrl);
  return getCached(key, 24 * 60 * 60 * 1000);
}

export async function setCachedSchema(docUrl: string, schema: any): Promise<void> {
  const key = getCacheKey(docUrl);
  return setCached(key, schema);
}
