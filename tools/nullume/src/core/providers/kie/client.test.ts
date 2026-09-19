import { test } from "node:test";
import assert from "node:assert";
import { normalizeStatus, extractFileUrl } from "./status.js";

test("normalizeStatus: jobs API success", () => {
  const data = {
    state: "success",
    resultJson: JSON.stringify({ resultUrls: ["http://example.com/img.png"] }),
  };
  const result = normalizeStatus("jobs", data);
  assert.strictEqual(result.state, "success");
  assert.deepStrictEqual(result.urls, ["http://example.com/img.png"]);
});

test("normalizeStatus: jobs API pending", () => {
  const data = { state: "waiting", progress: 50 };
  const result = normalizeStatus("jobs", data);
  assert.strictEqual(result.state, "pending");
  assert.strictEqual(result.progress, 50);
});

test("normalizeStatus: jobs API fail", () => {
  const data = { state: "fail", failMsg: "error", failCode: "500" };
  const result = normalizeStatus("jobs", data);
  assert.strictEqual(result.state, "fail");
  assert(result.failMsg?.includes("500"));
});

test("normalizeStatus: suno API success", () => {
  const data = {
    status: "SUCCESS",
    response: {
      sunoData: [
        { audioUrl: "http://example.com/audio.mp3", title: "Track 1" },
      ],
    },
  };
  const result = normalizeStatus("suno", data);
  assert.strictEqual(result.state, "success");
  assert.deepStrictEqual(result.urls, ["http://example.com/audio.mp3"]);
  assert(result.tracks);
});

test("extractFileUrl: finds downloadUrl", () => {
  const url = extractFileUrl({ downloadUrl: "http://example.com/file" });
  assert.strictEqual(url, "http://example.com/file");
});

test("extractFileUrl: finds nested data", () => {
  const url = extractFileUrl({
    data: { result: { fileUrl: "http://example.com/nested" } },
  });
  assert.strictEqual(url, "http://example.com/nested");
});

test("extractFileUrl: returns null for invalid", () => {
  const url = extractFileUrl({ foo: "bar" });
  assert.strictEqual(url, null);
});
