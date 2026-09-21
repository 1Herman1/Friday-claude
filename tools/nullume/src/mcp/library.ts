/**
 * Lazy library store and embedder initialization for MCP
 * Singleton pattern: one store and embedder per process
 */

import fs from "node:fs";
import path from "node:path";
import { openStore } from "../library/store/sqlite.js";
import { getEmbedder, type Embedder } from "../library/embed/index.js";
import { getLibraryDir, getLibraryDbPath } from "../core/paths.js";
import type { LibraryStore } from "../library/store/types.js";

let store: LibraryStore | null = null;
let embedder: Embedder | null | undefined = undefined; // undefined = not loaded, null = tried but failed

/**
 * Get or initialize the library store
 */
export function getStore(): LibraryStore {
  if (!store) {
    // Ensure library dir exists
    const libDir = getLibraryDir();
    if (!fs.existsSync(libDir)) {
      fs.mkdirSync(libDir, { recursive: true });
    }

    const dbPath = getLibraryDbPath();
    store = openStore(dbPath);
  }
  return store;
}

/**
 * Get or initialize the embedder (returns null if transformers not installed)
 */
export async function getEmbedderInstance(): Promise<Embedder | null> {
  if (embedder === undefined) {
    embedder = await getEmbedder();
  }
  return embedder;
}

/**
 * Close all resources
 */
export function closeLibrary(): void {
  if (store) {
    store.close();
  }
  store = null;
  embedder = undefined;
}
