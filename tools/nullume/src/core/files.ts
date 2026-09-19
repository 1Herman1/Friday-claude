import fs from "node:fs";
import path from "node:path";
import { ProviderError } from "./errors.js";

const DENY_PATTERNS = [".env", ".ssh", ".aws", "config.json", "id_", ".pem", ".key", "sessions/"];
const ALLOWED_TYPES: Record<string, string> = {
  "\x89PNG": "png",
  "\xFF\xD8\xFF": "jpg",
  "RIFF": "webp",
  "GIF8": "gif",
  "\x00\x00\x00\x18ftypmp4": "mp4",
  "ftypmp4": "mp4",
  "mdat": "mov",
  "\x1A\x45\xDF\xA3": "webm",
  "\xFF\xFB": "mp3",
  "\xFF\xF1": "m4a",
};

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

export async function assertUploadable(filePath: string, allowedRoots: string[]): Promise<string> {
  // Resolve and verify real path (no symlinks)
  const realPath = await fs.promises.realpath(filePath);

  // Check against allowed roots
  const isAllowed = allowedRoots.some((root) => {
    const resolvedRoot = path.resolve(root);
    // Сверяем реальный путь: симлинк внутри проекта, ведущий наружу, иначе
    // проходил проверку корней.
    return realPath.startsWith(resolvedRoot + path.sep) || realPath === resolvedRoot;
  });

  if (!isAllowed) {
    throw new ProviderError(`File not in allowed directories: ${filePath}`);
  }

  // Check deny patterns
  for (const pattern of DENY_PATTERNS) {
    if (realPath.includes(pattern)) {
      throw new ProviderError(`File path contains denied pattern: ${pattern}`);
    }
  }

  // Check file size before reading
  const stat = await fs.promises.stat(realPath);
  if (stat.size > MAX_FILE_SIZE) {
    throw new ProviderError(`File exceeds maximum size of 200MB: ${(stat.size / 1024 / 1024).toFixed(1)}MB`);
  }

  // Verify file type by magic bytes
  const buffer = Buffer.alloc(16);
  const fd = await fs.promises.open(realPath, "r");
  try {
    await fd.read(buffer, 0, 16);
  } finally {
    await fd.close();
  }

  let isValid = false;
  const bufStr = buffer.toString("binary");

  for (const [magic, ext] of Object.entries(ALLOWED_TYPES)) {
    if (bufStr.startsWith(magic)) {
      isValid = true;
      break;
    }
  }

  if (!isValid) {
    throw new ProviderError(`File type not allowed: ${realPath}`);
  }

  return realPath;
}
