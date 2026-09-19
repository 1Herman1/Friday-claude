import fs from "node:fs";
import path from "node:path";

export async function downloadFile(url: string, dest: string): Promise<string> {
  // Validate URL
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error(`Invalid URL scheme: ${url}`);
  }

  // Validate destination (no path traversal)
  // Check if the destination contains .. or resolves outside expected directory
  if (dest.includes("..")) {
    throw new Error(`Path traversal not allowed: ${dest}`);
  }

  const resolvedDest = path.resolve(dest);
  const dirname = path.dirname(resolvedDest);
  // Ensure the file is within a reasonable location (not root or system dirs)
  if (resolvedDest.startsWith("/etc") || resolvedDest.startsWith("/sys") || resolvedDest.startsWith("/proc")) {
    throw new Error(`Path traversal not allowed: ${dest}`);
  }

  const resp = await fetch(url, { signal: AbortSignal.timeout(300000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} downloading ${url}`);

  const buffer = await resp.arrayBuffer();
  if (buffer.byteLength === 0) throw new Error(`Empty file downloaded from ${url}`);

  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.writeFile(dest, Buffer.from(buffer));

  return dest;
}
