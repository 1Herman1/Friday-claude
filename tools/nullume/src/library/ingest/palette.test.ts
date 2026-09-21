import { test } from "node:test";
import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractPalette, paletteToHex } from "./palette.js";
import { Jimp } from "jimp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "__fixtures__");

test("palette module", async (t) => {
  await t.test("extractPalette returns k colors", async () => {
    const fixturePath = path.join(fixturesDir, "red-solid.png");
    const image = await Jimp.read(fixturePath);

    const palette = await extractPalette(image, 6);

    assert.strictEqual(palette.length, 6);
  });

  await t.test("extractPalette entries have valid structure", async () => {
    const fixturePath = path.join(fixturesDir, "red-solid.png");
    const image = await Jimp.read(fixturePath);

    const palette = await extractPalette(image, 6);

    for (const entry of palette) {
      assert(Array.isArray(entry.color));
      assert.strictEqual(entry.color.length, 3);
      assert(typeof entry.ratio === "number");
      assert(entry.ratio >= 0 && entry.ratio <= 1);

      const [r, g, b] = entry.color;
      assert(r >= 0 && r <= 255);
      assert(g >= 0 && g <= 255);
      assert(b >= 0 && b <= 255);
    }
  });

  await t.test("extractPalette ratios sum to ~1", async () => {
    const fixturePath = path.join(fixturesDir, "red-solid.png");
    const image = await Jimp.read(fixturePath);

    const palette = await extractPalette(image, 6);
    const sum = palette.reduce((s, e) => s + e.ratio, 0);

    assert(sum >= 0.99 && sum <= 1.01, `Expected sum ~1.0, got ${sum}`);
  });

  await t.test("extractPalette is deterministic with seed", async () => {
    const fixturePath = path.join(fixturesDir, "gradient.png");
    const image1 = await Jimp.read(fixturePath);
    const image2 = await Jimp.read(fixturePath);

    const palette1 = await extractPalette(image1, 6, 42);
    const palette2 = await extractPalette(image2, 6, 42);

    assert.strictEqual(JSON.stringify(palette1), JSON.stringify(palette2));
  });

  await t.test("extractPalette detects dominant colors in solid image", async () => {
    const fixturePath = path.join(fixturesDir, "red-solid.png");
    const image = await Jimp.read(fixturePath);

    const palette = await extractPalette(image, 3);

    // Solid red image should have high ratio for red-ish color
    const topColor = palette[0];
    const [r, g, b] = topColor.color;

    // Red should be dominant (high R, low G, low B)
    assert(r > 100, `Expected R > 100, got ${r}`);
    assert(g < 100, `Expected G < 100, got ${g}`);
    assert(b < 100, `Expected B < 100, got ${b}`);
    assert(topColor.ratio > 0.5, `Expected dominant ratio > 0.5, got ${topColor.ratio}`);
  });

  await t.test("extractPalette handles gradient image", async () => {
    const fixturePath = path.join(fixturesDir, "gradient.png");
    const image = await Jimp.read(fixturePath);

    const palette = await extractPalette(image, 6);

    // Gradient should have balanced ratios
    const minRatio = Math.min(...palette.map((e) => e.ratio));
    const maxRatio = Math.max(...palette.map((e) => e.ratio));

    assert(minRatio > 0, "Min ratio should be > 0");
    assert(maxRatio < 1, "Max ratio should be < 1");
    assert(maxRatio - minRatio < 0.5, "Gradient should have relatively balanced ratios");
  });

  await t.test("paletteToHex returns hex strings", async () => {
    const fixturePath = path.join(fixturesDir, "red-solid.png");
    const image = await Jimp.read(fixturePath);

    const palette = await extractPalette(image, 3);
    const hexes = paletteToHex(palette);

    assert.strictEqual(hexes.length, 3);
    for (const hex of hexes) {
      assert(/^#[0-9A-F]{6}$/.test(hex), `Invalid hex color: ${hex}`);
    }
  });

  await t.test("extractPalette with k=1 returns single color", async () => {
    const fixturePath = path.join(fixturesDir, "red-solid.png");
    const image = await Jimp.read(fixturePath);

    const palette = await extractPalette(image, 1);

    assert.strictEqual(palette.length, 1);
    assert.strictEqual(palette[0].ratio, 1.0);
  });
});
