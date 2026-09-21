import { test } from "node:test";
import assert from "node:assert";
import { RefCandidateSchema } from "./types.js";

test("RefCandidateSchema: должен принять объект с url", () => {
  const valid = {
    url: "https://example.com/image.jpg",
    source: "unsplash",
    sourceRef: "12345",
  };

  const result = RefCandidateSchema.parse(valid);
  assert.strictEqual(result.url, "https://example.com/image.jpg");
  assert.strictEqual(result.source, "unsplash");
});

test("RefCandidateSchema: должен принять объект с filePath", () => {
  const valid = {
    filePath: "/path/to/image.jpg",
    source: "local",
    sourceRef: "local-123",
  };

  const result = RefCandidateSchema.parse(valid);
  assert.strictEqual(result.filePath, "/path/to/image.jpg");
  assert.strictEqual(result.source, "local");
});

test("RefCandidateSchema: должен отклонить объект без url и filePath", () => {
  const invalid = {
    source: "test",
    sourceRef: "123",
  };

  const result = RefCandidateSchema.safeParse(invalid);
  assert(!result.success, "Ожидалось, что валидация не пройдёт");
});

test("RefCandidateSchema: должен установить значения по умолчанию", () => {
  const input = {
    url: "https://example.com/img.jpg",
    source: "test",
    sourceRef: "ref",
  };

  const result = RefCandidateSchema.parse(input);
  assert.deepStrictEqual(result.meta, {});
  assert.deepStrictEqual(result.tags, []);
});

test("RefCandidateSchema: должен валидировать RGB палитру", () => {
  const valid = {
    url: "https://example.com/img.jpg",
    source: "test",
    sourceRef: "ref",
    palette: [{ color: [255, 128, 0], ratio: 0.5 }],
  };

  const result = RefCandidateSchema.parse(valid);
  assert.strictEqual(result.palette?.[0].color[0], 255);
  assert.strictEqual(result.palette?.[0].ratio, 0.5);
});

test("RefCandidateSchema: должен отклонить палитру с неправильным RGB", () => {
  const invalid = {
    url: "https://example.com/img.jpg",
    source: "test",
    sourceRef: "ref",
    palette: [{ color: [256, 128, 0], ratio: 0.5 }], // 256 > 255
  };

  assert.throws(() => RefCandidateSchema.parse(invalid));
});
