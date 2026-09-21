import fs from "node:fs";
import { createHash } from "node:crypto";
import { Jimp } from "jimp";

/**
 * Compute SHA256 hash of a file
 */
export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = fs.createReadStream(path);

  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Compute dhash (difference hash) for an image
 * Returns a 64-bit hash as BigInt by comparing 9×8 grayscale grid
 */
export async function dhash64(image: any): Promise<bigint> {
  // Resize to 9×8 and convert to grayscale
  const resized = image.clone().resize({ w: 9, h: 8 });
  let hash = 0n;

  // Iterate row by row, comparing adjacent pixels
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const pixelLeft = getPixelGrayscale(resized, col, row);
      const pixelRight = getPixelGrayscale(resized, col + 1, row);
      const bit = pixelRight > pixelLeft ? 1n : 0n;
      hash = (hash << 1n) | bit;
    }
  }

  return hash;
}

/**
 * Get grayscale value of a pixel
 */
function getPixelGrayscale(image: any, x: number, y: number): number {
  const idx = (image.bitmap.width * y + x) << 2;
  const r = image.bitmap.data[idx];
  const g = image.bitmap.data[idx + 1];
  const b = image.bitmap.data[idx + 2];
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

/**
 * Compute Hamming distance between two 64-bit hashes
 */
export function hamming(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let distance = 0;

  while (xor > 0n) {
    if ((xor & 1n) === 1n) {
      distance++;
    }
    xor >>= 1n;
  }

  return distance;
}
