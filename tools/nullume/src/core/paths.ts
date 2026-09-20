import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function expandHome(p: string): string {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
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

export async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
  } catch (e) {
    if ((e as any)?.code !== "EEXIST") throw e;
  }
}
