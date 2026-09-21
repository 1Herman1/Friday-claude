import { test } from "node:test";
import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256File, dhash64, hamming } from "./hash.js";
import { Jimp } from "jimp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "__fixtures__");

test("hash module", async (t) => {
  await t.test("sha256File computes correct hash", async () => {
    const fixturePath = path.join(fixturesDir, "red-solid.png");
    const hash = await sha256File(fixturePath);
    assert(typeof hash === "string");
    assert.strictEqual(hash.length, 64);
    assert(/^[a-f0-9]{64}$/.test(hash));
  });

  await t.test("sha256File returns same hash for same file", async () => {
    const fixturePath = path.join(fixturesDir, "red-solid.png");
    const hash1 = await sha256File(fixturePath);
    const hash2 = await sha256File(fixturePath);
    assert.strictEqual(hash1, hash2);
  });

  await t.test("dhash64 produces 64-bit hash", async () => {
    const fixturePath = path.join(fixturesDir, "red-solid.png");
    const image = await Jimp.read(fixturePath);
    const hash = await dhash64(image);
    assert(typeof hash === "bigint");
    assert(hash >= 0n);
    assert(hash < 0x10000000000000000n); // 2^64
  });

  await t.test("dhash64 produces same hash for identical images", async () => {
    const fixturePath = path.join(fixturesDir, "red-solid.png");
    const image1 = await Jimp.read(fixturePath);
    const image2 = await Jimp.read(fixturePath);
    const hash1 = await dhash64(image1);
    const hash2 = await dhash64(image2);
    assert.strictEqual(hash1, hash2);
  });

  await t.test("hamming distance between identical hashes is 0", () => {
    const hash = 0x123456789abcdefn;
    const distance = hamming(hash, hash);
    assert.strictEqual(distance, 0);
  });

  await t.test("hamming distance is symmetric", () => {
    const hash1 = 0x123456789abcdefn;
    const hash2 = 0xfedcba9876543210n;
    const dist1 = hamming(hash1, hash2);
    const dist2 = hamming(hash2, hash1);
    assert.strictEqual(dist1, dist2);
  });

  await t.test("hamming distance detects single bit difference", () => {
    const hash1 = 0n;
    const hash2 = 1n;
    const distance = hamming(hash1, hash2);
    assert.strictEqual(distance, 1);
  });

  await t.test("dhash64 detects similar images (single pixel change)", async () => {
    const path1 = path.join(fixturesDir, "red-solid.png");
    const path2 = path.join(fixturesDir, "red-modified.png");

    const image1 = await Jimp.read(path1);
    const image2 = await Jimp.read(path2);

    const hash1 = await dhash64(image1);
    const hash2 = await dhash64(image2);

    const distance = hamming(hash1, hash2);
    // Single pixel change should result in small hamming distance
    assert(distance < 10, `Expected distance < 10, got ${distance}`);
  });
});
