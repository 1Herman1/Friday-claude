import fs from "node:fs";
import path from "node:path";
import { lookup } from "node:dns/promises";
import { NetworkError } from "./errors.js";

const MAX_SIZE = 512 * 1024 * 1024; // 512 MB

async function validateHost(hostname: string): Promise<void> {
  try {
    const result = await lookup(hostname);
    const addr = result.address;

    // Deny loopback, private, link-local, ULA
    if (
      addr === "127.0.0.1" ||
      addr === "::1" ||
      addr.startsWith("10.") ||
      addr.startsWith("172.16.") ||
      addr.startsWith("192.168.") ||
      addr.startsWith("fc") ||
      addr.startsWith("fd") ||
      addr.startsWith("169.254.") ||
      addr.startsWith("fe80:")
    ) {
      throw new NetworkError(`Denied host: ${hostname}`);
    }
  } catch (e) {
    throw new NetworkError(`DNS validation failed: ${hostname}`);
  }
}

export async function downloadFile(url: string, dest: string, root: string): Promise<string> {
  // Only https
  if (!url.startsWith("https://")) {
    throw new NetworkError(`Only https:// allowed, got: ${url}`);
  }

  // Validate destination
  const resolvedDest = path.resolve(dest);
  const resolvedRoot = path.resolve(root);

  if (!resolvedDest.startsWith(resolvedRoot + path.sep) && resolvedDest !== resolvedRoot) {
    throw new NetworkError(`Path traversal not allowed: ${dest}`);
  }

  const urlObj = new URL(url);
  await validateHost(urlObj.hostname || "");

  let resp = await fetch(url, {
    signal: AbortSignal.timeout(300000),
    redirect: "manual",
  });

  // Handle redirects manually
  while (resp.status >= 300 && resp.status < 400) {
    const location = resp.headers.get("Location");
    if (!location) throw new NetworkError(`Redirect without Location header: ${resp.status}`);

    const redirectUrl = new URL(location, url).href;
    if (!redirectUrl.startsWith("https://")) {
      throw new NetworkError(`Redirect to non-https: ${redirectUrl}`);
    }

    const redirectHost = new URL(redirectUrl).hostname || "";
    await validateHost(redirectHost);

    resp = await fetch(redirectUrl, {
      signal: AbortSignal.timeout(300000),
      redirect: "manual",
    });
  }

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
      if (totalBytes > MAX_SIZE) {
        throw new NetworkError(`File exceeds 512MB limit`);
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
