import { test } from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { makePreview, IngestError } from "./preview.js";
import { Jimp } from "jimp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "__fixtures__");

test("preview module", async (t) => {
  let tmpDir: string;

  await t.before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-test-"));
  });

  await t.after(async () => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  await t.test("makePreview creates JPEG from PNG", async () => {
    const srcPath = path.join(fixturesDir, "red-solid.png");
    const destPath = path.join(tmpDir, "preview.jpg");

    const result = await makePreview(srcPath, destPath);

    assert(fs.existsSync(destPath));
    assert.strictEqual(result.width, 64);
    assert.strictEqual(result.height, 64);

    // Verify it's a valid JPEG
    const buffer = fs.readFileSync(destPath);
    assert(buffer[0] === 0xff && buffer[1] === 0xd8); // JPEG magic bytes
  });

  await t.test("makePreview respects maxSide parameter", async () => {
    const srcPath = path.join(fixturesDir, "gradient.png");
    const destPath = path.join(tmpDir, "preview-scaled.jpg");

    const result = await makePreview(srcPath, destPath, 100);

    assert(fs.existsSync(destPath));
    // Original dimensions should be returned unchanged
    assert.strictEqual(result.width, 200);
    assert.strictEqual(result.height, 100);

    // Verify resized preview dimensions
    const image = await Jimp.read(destPath);
    assert(image.width <= 100);
    assert(image.height <= 100);
  });

  await t.test("makePreview creates missing directories", async () => {
    const srcPath = path.join(fixturesDir, "red-solid.png");
    const destPath = path.join(tmpDir, "nested", "dir", "preview.jpg");

    await makePreview(srcPath, destPath);

    assert(fs.existsSync(destPath));
  });

  await t.test("makePreview respects quality parameter", async () => {
    const srcPath = path.join(fixturesDir, "red-solid.png");
    const dest1 = path.join(tmpDir, "quality-high.jpg");
    const dest2 = path.join(tmpDir, "quality-low.jpg");

    await makePreview(srcPath, dest1, 512, 95);
    await makePreview(srcPath, dest2, 512, 30);

    const size1 = fs.statSync(dest1).size;
    const size2 = fs.statSync(dest2).size;

    // Higher quality should produce larger file
    assert(size1 > size2, `Quality 95 (${size1}B) should be larger than quality 30 (${size2}B)`);
  });

  await t.test("makePreview throws on oversized image", async () => {
    // Create a very large image in memory and check size limit
    const largeImage = new Jimp({ width: 7000, height: 6000, color: 0xff0000ff });
    const largePath = path.join(tmpDir, "large.png");
    await largeImage.write(largePath);

    const destPath = path.join(tmpDir, "preview-large.jpg");

    try {
      await makePreview(largePath, destPath);
      assert.fail("Should have thrown IngestError");
    } catch (e) {
      assert(e instanceof IngestError);
      assert.strictEqual((e as IngestError).code, "too-large");
    }
  });

  await t.test("makePreview returns correct dimensions for gradient", async () => {
    const srcPath = path.join(fixturesDir, "gradient.png");
    const destPath = path.join(tmpDir, "gradient-preview.jpg");

    const result = await makePreview(srcPath, destPath);

    assert.strictEqual(result.width, 200);
    assert.strictEqual(result.height, 100);
  });
});
