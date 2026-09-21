import fs from "node:fs";
import path from "node:path";
import { safeFetch } from "./net.js";
import { NetworkError } from "./errors.js";

const DEFAULT_MAX_BYTES = 512 * 1024 * 1024; // 512 MB

/**
 * Загрузить файл по HTTPS URL с проверкой размера и валидацией хоста
 * @param url URL файла (только https://)
 * @param dest Путь назначения (должен быть внутри root)
 * @param root Корневой каталог для валидации пути
 * @param maxBytes Максимальный размер в байтах (по умолчанию 512 МБ)
 * @returns Путь к загруженному файлу
 * @throws NetworkError при превышении размера, валидации или сетевых ошибках
 */
export async function downloadFile(
  url: string,
  dest: string,
  root: string,
  maxBytes: number = DEFAULT_MAX_BYTES
): Promise<string> {
  // Validate destination
  const resolvedDest = path.resolve(dest);
  const resolvedRoot = path.resolve(root);

  if (!resolvedDest.startsWith(resolvedRoot + path.sep) && resolvedDest !== resolvedRoot) {
    throw new NetworkError(`Path traversal not allowed: ${dest}`);
  }

  // Использовать safeFetch для безопасной загрузки
  const resp = await safeFetch(url, { maxBytes, timeoutMs: 300000 });

  if (!resp.ok) throw new NetworkError(`HTTP ${resp.status} downloading ${url}`);

  // Stream write with size limit
  await fs.promises.mkdir(path.dirname(dest), { recursive: true, mode: 0o700 });

  const writer = fs.createWriteStream(dest);
  let totalBytes = 0;

  if (!resp.body) throw new NetworkError("No response body");

  const reader = resp.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.length;
      if (totalBytes > maxBytes) {
        throw new NetworkError(`File exceeds ${(maxBytes / 1024 / 1024).toFixed(0)}MB limit`);
      }

      writer.write(Buffer.from(value));
    }
  } finally {
    writer.end();
    reader.cancel();
  }

  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(dest));
    writer.on("error", reject);
  });
}
