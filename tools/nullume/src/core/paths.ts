import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function expandHome(p: string): string {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
}

/**
 * Finds the root directory of the nullume package by walking up the tree
 * looking for package.json with name "nullume"
 */
export function packageRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));

  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg.name === "nullume") {
          return dir;
        }
      } catch {
        // continue searching
      }
    }
    dir = path.dirname(dir);
  }

  // Fallback to two levels up from this file (src/core/paths.ts -> ../../)
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
}

/**
 * Get the data directory path within the package
 */
export function getPackageDataDir(): string {
  return path.join(packageRoot(), "data");
}

export function getDataDir(): string {
  const home = process.env.NULLUME_HOME ? expandHome(process.env.NULLUME_HOME) : path.join(os.homedir(), ".nullume");
  return home;
}

export function getCacheDir(): string {
  return path.join(getDataDir(), "cache");
}

export function getJobsDir(): string {
  return path.join(getDataDir(), "jobs");
}

export function getDownloadsDir(): string {
  return path.join(getDataDir(), "downloads");
}

export function getConfigPath(): string {
  return path.join(getDataDir(), "config.json");
}

export function getSessionsDir(): string {
  return path.join(getDataDir(), "sessions");
}

/**
 * Получить путь к каталогу библиотеки вкуса (~/.nullume/library)
 */
export function getLibraryDir(): string {
  return path.join(getDataDir(), "library");
}

/**
 * Получить путь к БД библиотеки (~/.nullume/library/library.db)
 */
export function getLibraryDbPath(): string {
  return path.join(getLibraryDir(), "library.db");
}

/**
 * Получить путь к каталогу оригиналов референсов (~/.nullume/library/originals)
 */
export function getLibraryOriginalsDir(): string {
  return path.join(getLibraryDir(), "originals");
}

/**
 * Получить путь к каталогу превью (~/.nullume/library/previews)
 */
export function getLibraryPreviewsDir(): string {
  return path.join(getLibraryDir(), "previews");
}

/**
 * Получить путь к каталогу моделей embeddings (~/.nullume/models)
 */
export function getModelsDir(): string {
  return path.join(getDataDir(), "models");
}

export async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
  } catch (e) {
    if ((e as any)?.code !== "EEXIST") throw e;
  }
}
