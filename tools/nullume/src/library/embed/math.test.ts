import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cosine,
  euclid2,
  normalize,
  mean,
  toBlob,
  fromBlob,
} from "./math.js";

test("normalize: длина становится 1", () => {
  const v = new Float32Array([3, 4]);
  normalize(v);
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
  assert.ok(Math.abs(len - 1) < 1e-6);
});

test("normalize: нулевой вектор остаётся нулевым", () => {
  const v = new Float32Array([0, 0, 0]);
  normalize(v);
  assert.deepEqual(v, new Float32Array([0, 0, 0]));
});

test("cosine: идентичные нормализованные векторы → 0", () => {
  const a = new Float32Array([1, 0, 0]);
  const b = new Float32Array([1, 0, 0]);
  normalize(a);
  normalize(b);
  const dist = cosine(a, b);
  assert.ok(Math.abs(dist) < 1e-6);
});

test("cosine: противоположные нормализованные векторы → sqrt(4)=2", () => {
  const a = new Float32Array([1, 0, 0]);
  const b = new Float32Array([-1, 0, 0]);
  normalize(a);
  normalize(b);
  const dist = cosine(a, b);
  // dot = -1, так что sqrt(2 * (1 - (-1))) = sqrt(4) = 2
  assert.ok(Math.abs(dist - 2) < 1e-5);
});

test("euclid2: расстояние в квадрате", () => {
  const a = new Float32Array([0, 0]);
  const b = new Float32Array([3, 4]);
  const dist2 = euclid2(a, b);
  assert.strictEqual(dist2, 25); // 3^2 + 4^2
});

test("mean: среднее двух векторов", () => {
  const vectors = [
    new Float32Array([1, 2, 3]),
    new Float32Array([3, 4, 5]),
  ];
  const avg = mean(vectors);
  assert.deepEqual(avg, new Float32Array([2, 3, 4]));
});

test("toBlob/fromBlob: round-trip", () => {
  const original = new Float32Array([1.5, 2.5, 3.5, 4.5]);
  const blob = toBlob(original);
  const restored = fromBlob(blob);

  for (let i = 0; i < original.length; i++) {
    assert.ok(Math.abs(restored[i] - original[i]) < 1e-6);
  }
});

test("toBlob: возвращает Buffer", () => {
  const v = new Float32Array([1, 2, 3]);
  const blob = toBlob(v);
  assert.ok(Buffer.isBuffer(blob));
  assert.strictEqual(blob.length, 12); // 3 * 4 bytes
});

test("fromBlob: восстанавливает размер", () => {
  const original = new Float32Array([1.1, 2.2, 3.3, 4.4, 5.5]);
  const blob = toBlob(original);
  const restored = fromBlob(blob);
  assert.strictEqual(restored.length, 5);
});
