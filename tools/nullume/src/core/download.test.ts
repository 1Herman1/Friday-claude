import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { downloadFile } from "./download.js";

test("downloadFile rejects invalid URLs", async () => {
  try {
    await downloadFile("file:///etc/passwd", "/tmp/test");
    assert.fail("Should reject file:// URLs");
  } catch (e) {
    assert((e as any).message.includes("Invalid URL"));
  }
});

test("downloadFile rejects path traversal", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-test-"));
  const oldFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => new Response(Buffer.from("data")) as any;

    try {
      // Try to escape the temp directory - use raw string to preserve ..
      const traversalPath = tempDir + "/subdir/../../etc/passwd";
      await downloadFile("http://example.com/file", traversalPath);
      assert.fail("Should reject path traversal");
    } catch (e) {
      assert((e as any).message.includes("Path traversal"));
    }
  } finally {
    globalThis.fetch = oldFetch;
    fs.rmSync(tempDir, { recursive: true });
  }
});

test("downloadFile rejects empty responses", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-test-"));
  const oldFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => new Response(Buffer.from("")) as any;

    try {
      await downloadFile("http://example.com/empty", path.join(tempDir, "empty.txt"));
      assert.fail("Should reject empty files");
    } catch (e) {
      assert((e as any).message.includes("Empty"));
    }
  } finally {
    globalThis.fetch = oldFetch;
    fs.rmSync(tempDir, { recursive: true });
  }
});
