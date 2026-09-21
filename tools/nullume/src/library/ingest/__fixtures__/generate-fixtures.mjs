import { Jimp } from "jimp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generateFixtures() {
  console.log("Generating PNG fixtures...");

  // 1. Solid red 64×64
  const red = new Jimp({ width: 64, height: 64, color: 0xff0000ff });
  await red.write(path.join(__dirname, "red-solid.png"));
  console.log("✓ red-solid.png");

  // 2. Gradient 200×100 (left red to right blue)
  const gradient = new Jimp({ width: 200, height: 100, color: 0xff0000ff });
  for (let x = 0; x < 200; x++) {
    const ratio = x / 200;
    const r = Math.round(255 * (1 - ratio));
    const b = Math.round(255 * ratio);
    const color = (r << 24) | (0 << 16) | (b << 8) | 255;

    for (let y = 0; y < 100; y++) {
      gradient.setPixelColor(color >>> 0, x, y);
    }
  }
  await gradient.write(path.join(__dirname, "gradient.png"));
  console.log("✓ gradient.png");

  // 3. Copy of red solid with one pixel modified
  const redModified = new Jimp({ width: 64, height: 64, color: 0xff0000ff });
  // Change pixel at (10, 10) to green
  redModified.setPixelColor(0x00ff00ff >>> 0, 10, 10);
  await redModified.write(path.join(__dirname, "red-modified.png"));
  console.log("✓ red-modified.png");

  console.log("Done!");
}

generateFixtures().catch(console.error);
