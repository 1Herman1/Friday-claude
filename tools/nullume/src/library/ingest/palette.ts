import { Jimp } from "jimp";

export interface PaletteEntry {
  color: [number, number, number];
  ratio: number;
}

type JimpImage = Awaited<ReturnType<typeof Jimp.read>>;

/**
 * Convert sRGB to linear RGB
 */
function srgbToLinear(value: number): number {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * Convert linear RGB to sRGB
 */
function linearToSrgb(value: number): number {
  return value <= 0.0031308 ? 12.92 * value : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}

/**
 * Convert sRGB to XYZ
 */
function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const x = lr * 0.4124 + lg * 0.3576 + lb * 0.1805;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = lr * 0.0193 + lg * 0.1192 + lb * 0.9505;

  return [x, y, z];
}

/**
 * Lab color component converter
 */
function labComponent(value: number): number {
  const delta = 6 / 29;
  return value > delta * delta * delta
    ? Math.cbrt(value)
    : value / (3 * delta * delta) + 4 / 29;
}

/**
 * Convert XYZ to Lab (using D65 standard illuminant)
 */
function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const xn = 0.95047;
  const yn = 1.0;
  const zn = 1.08883;

  const l = 116 * labComponent(y / yn) - 16;
  const a = 500 * (labComponent(x / xn) - labComponent(y / yn));
  const b = 200 * (labComponent(y / yn) - labComponent(z / zn));

  return [l, a, b];
}

/**
 * Convert sRGB to Lab color space
 */
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

/**
 * Euclidean distance in Lab space
 */
function labDistance(c1: [number, number, number], c2: [number, number, number]): number {
  const dl = c1[0] - c2[0];
  const da = c1[1] - c2[1];
  const db = c1[2] - c2[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

/**
 * Extract k most dominant colors using k-means++ in Lab space
 * @param image Jimp image
 * @param k Number of colors (default 6)
 * @param seed Random seed for deterministic results (default 42)
 * @returns Array of PaletteEntry sorted by ratio
 */
export async function extractPalette(
  image: JimpImage,
  k: number = 6,
  seed: number = 42
): Promise<PaletteEntry[]> {
  // Resize to 64×64 for faster processing
  const small = image.clone().resize({ w: 64, h: 64 });

  // Extract all pixels as Lab colors
  const pixels: Array<[number, number, number]> = [];
  for (let i = 0; i < small.bitmap.data.length; i += 4) {
    const r = small.bitmap.data[i];
    const g = small.bitmap.data[i + 1];
    const b = small.bitmap.data[i + 2];
    const lab = rgbToLab(r, g, b);
    pixels.push(lab);
  }

  // Initialize centroids using k-means++
  const rng = mulberry32(seed);
  const centroids: Array<[number, number, number]> = [];

  // First centroid: random pixel
  centroids.push(pixels[Math.floor(rng() * pixels.length)]);

  // Choose remaining centroids with probability proportional to distance squared
  for (let i = 1; i < k; i++) {
    let sum = 0;
    const distances: number[] = [];

    for (const pixel of pixels) {
      let minDist = Infinity;
      for (const centroid of centroids) {
        minDist = Math.min(minDist, labDistance(pixel, centroid));
      }
      const dist = minDist * minDist;
      distances.push(dist);
      sum += dist;
    }

    let rand = rng() * sum;
    for (let j = 0; j < distances.length; j++) {
      rand -= distances[j];
      if (rand <= 0) {
        centroids.push(pixels[j]);
        break;
      }
    }
  }

  // K-means iterations
  let assignments = new Array(pixels.length).fill(0);
  for (let iter = 0; iter < 10; iter++) {
    // Assign pixels to nearest centroid
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity;
      let bestCluster = 0;

      for (let j = 0; j < centroids.length; j++) {
        const dist = labDistance(pixels[i], centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = j;
        }
      }

      assignments[i] = bestCluster;
    }

    // Update centroids
    const counts = new Array(k).fill(0);
    const sums: Array<[number, number, number]> = Array(k)
      .fill(0)
      .map(() => [0, 0, 0]);

    for (let i = 0; i < pixels.length; i++) {
      const cluster = assignments[i];
      counts[cluster]++;
      sums[cluster][0] += pixels[i][0];
      sums[cluster][1] += pixels[i][1];
      sums[cluster][2] += pixels[i][2];
    }

    for (let j = 0; j < k; j++) {
      if (counts[j] > 0) {
        centroids[j] = [sums[j][0] / counts[j], sums[j][1] / counts[j], sums[j][2] / counts[j]];
      }
    }
  }

  // Convert centroids back to RGB and compute ratios
  const counts = new Array(k).fill(0);
  for (let i = 0; i < pixels.length; i++) {
    counts[assignments[i]]++;
  }

  const entries: PaletteEntry[] = centroids.map((lab, idx) => {
    const ratio = counts[idx] / pixels.length;
    return { color: labToRgb(lab[0], lab[1], lab[2]), ratio };
  });

  // Sort by ratio descending
  entries.sort((a, b) => b.ratio - a.ratio);

  return entries;
}

/**
 * Convert Lab back to sRGB
 */
function labToRgb(l: number, a: number, b: number): [number, number, number] {
  const yn = 1.0;
  const xn = 0.95047;
  const zn = 1.08883;

  const delta = 6 / 29;
  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const x = xn * (fx * fx * fx > delta * delta * delta ? fx * fx * fx : (fx - 4 / 29) * 3 * delta * delta);
  const y = yn * (fy * fy * fy > delta * delta * delta ? fy * fy * fy : (fy - 4 / 29) * 3 * delta * delta);
  const z = zn * (fz * fz * fz > delta * delta * delta ? fz * fz * fz : (fz - 4 / 29) * 3 * delta * delta);

  const r = linearToSrgb(x * 3.2406 + y * -1.5372 + z * -0.4986);
  const g = linearToSrgb(x * -0.9689 + y * 1.8758 + z * 0.0415);
  const bb = linearToSrgb(x * 0.0557 + y * -0.204 + z * 1.057);

  return [Math.round(Math.max(0, Math.min(255, r * 255))), Math.round(Math.max(0, Math.min(255, g * 255))), Math.round(Math.max(0, Math.min(255, bb * 255)))];
}

/**
 * Mulberry32 PRNG for deterministic random numbers
 */
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convert palette entries to hex color strings
 */
export function paletteToHex(entries: PaletteEntry[]): string[] {
  return entries.map(({ color }) => {
    const [r, g, b] = color;
    return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
  });
}
