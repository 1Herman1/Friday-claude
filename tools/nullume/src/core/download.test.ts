import { test } from "node:test";
import assert from "node:assert";
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
  const mockFetch: any = async () => new Response(Buffer.from("data"));

  try {
    await downloadFile("http://example.com/file", "../../../etc/passwd");
    assert.fail("Should reject path traversal");
  } catch (e) {
    assert((e as any).message.includes("Path traversal"));
  }
});

test("downloadFile rejects empty responses", async () => {
  const mockFetch: any = async () => new Response(Buffer.from(""));

  try {
    await downloadFile("http://example.com/empty", "/tmp/empty");
    assert.fail("Should reject empty files");
  } catch (e) {
    assert((e as any).message.includes("Empty"));
  }
});
